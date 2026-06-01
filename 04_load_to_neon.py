import os, sys, uuid, json
import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv()
PG_URL = os.getenv("DIRECT_URL")

TIPO_MAP = {1: "material", 2: "mano_obra", 3: "maquinaria", 4: "basico_obra", 5: "subcontrato"}
TIER_MAP = {48: "constructor", 49: "concursos", 50: "remodelador", 51: "desarrollador"}

print("Reading CSVs...")
budgets   = pd.read_csv("extracted_data/budgets.csv")
partidas  = pd.read_csv("extracted_data/partidas.csv")
catalog   = pd.read_csv("extracted_data/catalog.csv", low_memory=False)
units     = pd.read_csv("extracted_data/units.csv")
expins    = pd.read_csv("extracted_data/expins.csv")
conceptos = pd.read_csv("extracted_data/conceptos.csv")
matrices  = pd.read_csv("extracted_data/matrices.csv")
costs     = pd.read_csv("extracted_data/costs.csv")
families  = pd.read_csv("extracted_data/families.csv")
intelimats = pd.read_csv("extracted_data/intelimats.csv")

FAMILY_MAP = {int(r["idFamilia"]): r["Familia"] for _, r in families.iterrows()}
unit_map = {int(r["IdUnidad"]): str(r["Unidad"]) for _, r in units.iterrows()}

# ── Build ALL mappings upfront ──────────────────────────────────────────────
print("Building ID maps...")

# ExpIns → Catalog ID
ei_to_cat = {int(r["IdExpIns"]): int(r["IdCodigo"]) for _, r in expins.iterrows()}

# Determine conceptos vs insumos via matrices → ExpIns → Catalog
concept_ei = set(int(x) for x in matrices["IdCodigoMatriz"].unique())
insumo_ei  = set(int(x) for x in matrices["IdCodigoInsumo"].unique())
concept_cat = {ei_to_cat[e] for e in concept_ei if e in ei_to_cat}
insumo_cat  = {ei_to_cat[e] for e in insumo_ei if e in ei_to_cat}
all_needed = concept_cat | insumo_cat
print(f"  Concepto catalog IDs: {len(concept_cat):,}")
print(f"  Insumo catalog IDs: {len(insumo_cat):,}")

# Generate uuid map for ALL catalog items (prices may reference any of them)
cat_uuid = {int(r["IdCodigo"]): str(uuid.uuid4()) for _, r in catalog.iterrows()}

# Partida UUIDs (deterministic per code, deduplicated across tiers)
partida_uuid = {}
partida_tiers = defaultdict(set)
partida_nombre = {}
partida_renglon = {}
partida_parent = {}  # code → parent_code
ppid_to_code = {}  # (IdPresupuestoPartida, budget) → code

for _, r in partidas.iterrows():
    code = str(r["Partida"])
    budget = int(r["IdPresupuesto"])
    ppid = int(r["IdPresupuestoPartida"])
    partida_tiers[code].add(TIER_MAP.get(budget))
    ppid_to_code[(ppid, budget)] = code
    if budget == 48:  # constructor as canonical
        partida_nombre[code] = str(r["DescripcionPartidaLarga"]) if pd.notna(r["DescripcionPartidaLarga"]) and str(r["DescripcionPartidaLarga"]).strip() else str(r["DescripcionPartida"])
        partida_renglon[code] = int(r["Renglon"]) if pd.notna(r["Renglon"]) else 0

for code in partida_tiers:
    partida_uuid[code] = str(uuid.uuid4())

# Build parent code links (from constructor budget 48)
code_parent_map = {}
for _, r in partidas.iterrows():
    if int(r["IdPresupuesto"]) != 48: continue
    code = str(r["Partida"])
    ppid = int(r["IdPresupuestoPartida"])
    parent_ppid = int(r["IdPartidaPadre"]) if pd.notna(r["IdPartidaPadre"]) and int(r["IdPartidaPadre"]) > 0 else None
    if parent_ppid:
        parent_code = ppid_to_code.get((parent_ppid, 48))
        if parent_code:
            code_parent_map[code] = parent_code

# Concepto tiers
concepto_tiers = defaultdict(set)
for _, r in conceptos.iterrows():
    cid = ei_to_cat.get(int(r["IdExpIns"]))
    if cid:
        concepto_tiers[cid].add(TIER_MAP.get(int(r["IdPresupuesto"]), "constructor"))

# Save the map so prices can reference existing insumo UUIDs
uuid_map_path = "extracted_data/cat_uuid_map.json"
with open(uuid_map_path, "w") as f:
    json.dump(cat_uuid, f)
print(f"  Saved UUID map ({len(cat_uuid)} entries)")

# ── Connect ─────────────────────────────────────────────────────────────────
conn = psycopg2.connect(PG_URL)
conn.autocommit = False
cur = conn.cursor()

# ═══════════════════════════════════════════════════════════════════════════
# 1. PARTIDAS (deduplicated: 4 tiers → 1 row with tiers[])
# ═══════════════════════════════════════════════════════════════════════════
print("\nPartidas...")
rows = []
for code in sorted(partida_uuid.keys()):
    rows.append((partida_uuid[code], code, partida_nombre.get(code, code),
                 partida_renglon.get(code, 0), sorted(partida_tiers[code])))
psycopg2.extras.execute_values(cur, "INSERT INTO partidas (id, clave_neodata, nombre, orden, tiers) VALUES %s ON CONFLICT (id) DO NOTHING", rows)
conn.commit()
# Padre refs
for code, parent_code in code_parent_map.items():
    if parent_code in partida_uuid:
        cur.execute("UPDATE partidas SET padre_id = %s WHERE id = %s", (partida_uuid[parent_code], partida_uuid[code]))
conn.commit()
# Paths
cur.execute("""
    WITH RECURSIVE tree AS (
        SELECT id, clave_neodata, padre_id, '/' || COALESCE(clave_neodata, id::text) AS path FROM partidas WHERE padre_id IS NULL
        UNION ALL
        SELECT p.id, p.clave_neodata, p.padre_id, t.path || '/' || COALESCE(p.clave_neodata, p.id::text)
        FROM partidas p JOIN tree t ON p.padre_id = t.id
    )
    UPDATE partidas SET path = tree.path FROM tree WHERE partidas.id = tree.id
""")
conn.commit()
print(f"  {len(rows):,} partidas")

# ═══════════════════════════════════════════════════════════════════════════
# 2. INSUMOS
# ═══════════════════════════════════════════════════════════════════════════
print("\nInsumos...")
rows = []
for _, r in catalog.iterrows():
    cid = int(r["IdCodigo"])
    if cid not in insumo_cat: continue
    uid = cat_uuid[cid]
    nombre = str(r["DescripcionLarga"]) if pd.notna(r["DescripcionLarga"]) and str(r["DescripcionLarga"]).strip() else str(r["Descripcion"])
    tipo = TIPO_MAP.get(int(r["IdTipo"]), "material") if pd.notna(r["IdTipo"]) else "material"
    unidad = unit_map.get(int(r["IdUnidad"]), "PZA")
    familia = FAMILY_MAP.get(int(r["IdFamilia"])) if pd.notna(r.get("IdFamilia")) else None
    rows.append((uid, str(r["Codigo"]), nombre, unidad, tipo, familia))

for i in range(0, len(rows), 5000):
    batch = rows[i:i+5000]
    psycopg2.extras.execute_values(cur, "INSERT INTO insumos (id, clave_neodata, nombre, unidad, tipo, familia) VALUES %s ON CONFLICT (id) DO NOTHING", batch)
    conn.commit()
    print(f"  {min(i+5000, len(rows)):,}/{len(rows):,}", end="\r", flush=True)
print(f"\n  {len(rows):,} insumos")

# ═══════════════════════════════════════════════════════════════════════════
# 3. CONCEPTOS
# ═══════════════════════════════════════════════════════════════════════════
print("\nConceptos...")

# Build partida_id map: (IdCodigo, IdPresupuesto) → partida UUID
# Link: conceptos CSV (IdExpIns) → expins (IdCodigo) → conceptos DB (Codigo)
#        conceptos CSV (IdPresupuestoPartida, IdPresupuesto) → partidas DB
conc_partida_map = {}
for _, r in conceptos.iterrows():
    budget = int(r["IdPresupuesto"])
    ppid = int(r["IdPresupuestoPartida"])
    eid = int(r["IdExpIns"])
    cid = ei_to_cat.get(eid)
    if cid is None: continue
    code = ppid_to_code.get((ppid, budget))
    part_uuid = partida_uuid.get(code) if code else None
    if part_uuid:
        conc_partida_map[(cid, budget)] = part_uuid

rows = []
for _, r in catalog.iterrows():
    cid = int(r["IdCodigo"])
    if cid not in concept_cat: continue
    uid = cat_uuid[cid]
    nombre = str(r["DescripcionLarga"]) if pd.notna(r["DescripcionLarga"]) and str(r["DescripcionLarga"]).strip() else str(r["Descripcion"])
    unidad = unit_map.get(int(r["IdUnidad"]), "PZA")
    tiers = list(concepto_tiers.get(cid, []))
    # Use constructor budget (48) for partida_id reference
    partida_id = conc_partida_map.get((cid, 48))
    rows.append((uid, str(r["Codigo"]), nombre, unidad, tiers, partida_id))

for i in range(0, len(rows), 5000):
    batch = rows[i:i+5000]
    psycopg2.extras.execute_values(cur, "INSERT INTO conceptos (id, clave_neodata, nombre, unidad, tier, partida_id) VALUES %s ON CONFLICT (id) DO NOTHING", batch)
    conn.commit()
    print(f"  {min(i+5000, len(rows)):,}/{len(rows):,}", end="\r", flush=True)
print(f"\n  {len(rows):,} conceptos")

# ═══════════════════════════════════════════════════════════════════════════
# 4. MATRICES
# ═══════════════════════════════════════════════════════════════════════════
print("\nMatrices...")
rows = []
for _, r in matrices.iterrows():
    cei, iei = int(r["IdCodigoMatriz"]), int(r["IdCodigoInsumo"])
    ccid, icid = ei_to_cat.get(cei), ei_to_cat.get(iei)
    if not ccid or not icid: continue
    cuuid, iuuid = cat_uuid.get(ccid), cat_uuid.get(icid)
    if not cuuid or not iuuid: continue
    cantidad = float(r["Volumen"]) if pd.notna(r["Volumen"]) else 0.0
    if pd.notna(r["Expresion"]) and str(r["Expresion"]).strip():
        try: cantidad = eval(str(r["Expresion"]).strip())
        except: pass
    rows.append((str(uuid.uuid4()), cuuid, iuuid, cantidad, int(r["Renglon"]) if pd.notna(r["Renglon"]) else 0))

for i in range(0, len(rows), 10000):
    batch = rows[i:i+10000]
    psycopg2.extras.execute_values(cur, "INSERT INTO matrices (id, concepto_id, insumo_id, cantidad, orden) VALUES %s ON CONFLICT (concepto_id, insumo_id, nivel) DO NOTHING", batch)
    conn.commit()
    print(f"  {min(i+10000, len(rows)):,}/{len(rows):,}", end="\r", flush=True)
print(f"\n  {len(rows):,} matrices")

# ═══════════════════════════════════════════════════════════════════════════
# 5. PRICES
# ═══════════════════════════════════════════════════════════════════════════
print("\nPrices...")
ei_info = {int(r["IdExpIns"]): (int(r["IdCodigo"]), int(r["IdPresupuesto"])) for _, r in expins.iterrows()}
rows = []
for _, r in costs.iterrows():
    eid = int(r["IdExpIns"])
    if eid not in ei_info: continue
    cid, pid = ei_info[eid]
    if cid not in insumo_cat: continue  # prices only for insumos
    iuuid = cat_uuid.get(cid)
    if not iuuid: continue
    rows.append((str(uuid.uuid4()), iuuid, 1, TIER_MAP.get(pid), float(r["Costo"]) if pd.notna(r["Costo"]) else 0.0, 'MXN', 'neodata_seed', 0.60, str(r["Fecha"])[:10] if pd.notna(r["Fecha"]) else "2025-01-01"))

for i in range(0, len(rows), 10000):
    batch = rows[i:i+10000]
    psycopg2.extras.execute_values(cur, "INSERT INTO precios (id, insumo_id, region_id, tier, precio, moneda, fuente_tipo, confianza, fecha) VALUES %s", batch)
    conn.commit()
    print(f"  {min(i+10000, len(rows)):,}/{len(rows):,}", end="\r", flush=True)
print(f"\n  {len(rows):,} prices")

# ═══════════════════════════════════════════════════════════════════════════
# 6. INTELIMATS
# ═══════════════════════════════════════════════════════════════════════════
print("\nIntelimats...")
rows = [(str(uuid.uuid4()), str(r["Partida"]), str(r["InteliMat"]), "Phase 3 - not implemented") for _, r in intelimats.iterrows()]
psycopg2.extras.execute_values(cur, "INSERT INTO intelimats_catalog (id, clave_neodata, nombre, notas) VALUES %s", rows)
conn.commit()
print(f"  {len(rows):,} intelimats")

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
cur.execute("""
    SELECT 'partidas', COUNT(*) FROM partidas UNION ALL
    SELECT 'insumos', COUNT(*) FROM insumos UNION ALL
    SELECT 'conceptos', COUNT(*) FROM conceptos UNION ALL
    SELECT 'matrices', COUNT(*) FROM matrices UNION ALL
    SELECT 'precios', COUNT(*) FROM precios UNION ALL
    SELECT 'intelimats_catalog', COUNT(*) FROM intelimats_catalog ORDER BY 1
""")
print("\n" + "="*50)
for tbl, cnt in cur.fetchall():
    print(f"  {tbl:25s} {cnt:>10,}")
print("="*50)

cur.close()
conn.close()
print("Done!")
