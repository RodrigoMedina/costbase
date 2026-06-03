"""
Intelimat Priority Scoring v2 — Balanced Category Coverage
Selects 70 intelimats with broad cross-category representation.
"""
import os, math, csv, psycopg2
from collections import Counter, defaultdict

DB_URL = os.environ["DATABASE_URL"]

# Phase weight — how early in construction
PHASE_WEIGHTS = {
    "03": 100, "04": 90, "05": 85, "06": 70, "07": 55,
    "09": 45, "10": 40, "13": 35, "15": 65, "16": 60,
}

# Complexity by (cat_prefix, code)
COMPLEXITY = {
    ("03","P1"):3.0, ("03","P5"):3.0,
    ("03","Z1"):2.5, ("03","Z10"):2.0, ("03","Z11"):2.0,
    ("03","Z2"):2.5, ("03","Z21"):2.0, ("03","Z22"):2.0,
    ("03","Z23"):2.0, ("03","Z24"):2.0,
    ("03","Z3"):2.5, ("03","Z4"):2.5, ("03","Z5"):2.5,
    ("03","Z6"):2.5, ("03","Z7"):2.5, ("03","Z8"):2.5, ("03","Z9"):2.0,
    ("03","CT1"):2.0, ("03","CT2"):2.5, ("03","CT3"):2.5, ("03","CT4"):3.0,
    ("03","L2"):3.0, ("03","M1"):2.5, ("03","M2"):2.5, ("03","M3"):2.5, ("03","M4"):2.5,
    ("04","C1"):2.0, ("04","C10"):2.0, ("04","C2"):2.0,
    ("04","C3"):2.0, ("04","C4"):2.5, ("04","C5"):2.5, ("04","C6"):2.5,
    ("04","M1"):2.0, ("04","M2"):2.0,
    ("04","T1"):2.0, ("04","T2"):2.5, ("04","T3"):3.0, ("04","T4"):3.0,
    ("04","L1"):3.0, ("04","L2"):3.0, ("04","L3"):3.0, ("04","L4"):2.5,
    ("05","A1"):2.0, ("05","C1"):2.0, ("05","C2"):2.0, ("05","C3"):2.0,
    ("05","C4"):2.0, ("05","C5"):2.0, ("05","P1"):2.0, ("05","P2"):1.5,
    ("05","P3"):1.5, ("05","T1"):2.0, ("05","T2"):2.0, ("05","T3"):2.0,
    ("06","K1"):1.5, ("06","K10"):1.5, ("06","K11"):1.5,
    ("06","K2"):1.5, ("06","K3"):1.5, ("06","K4"):1.5,
    ("06","K5"):1.5, ("06","K6"):1.5, ("06","K8"):1.5,
    ("06","M1"):1.0, ("06","M2"):1.0, ("06","M3"):1.0,
    ("06","M4"):1.0, ("06","M5"):1.0, ("06","M6"):1.5,
    ("06","M7"):1.0, ("06","M8"):1.0, ("06","M9"):1.0,
    ("06","D1"):1.5, ("06","D2"):1.5, ("06","D3"):1.5,
    ("06","D4"):1.5, ("06","D5"):1.5, ("06","D6"):1.5,
    ("06","R1"):1.5, ("06","R2"):1.5, ("06","R3"):1.5, ("06","R4"):1.5, ("06","R5"):1.5,
    ("06","A1"):1.5, ("06","A2"):1.5, ("06","A3"):1.5, ("06","A4"):1.5, ("06","A5"):1.5,
    ("06","B1"):1.5, ("06","C1"):1.5, ("06","C2"):1.5,
    ("06","E1"):2.5, ("06","E2"):2.5, ("06","E3"):2.5, ("06","E4"):2.5,
    ("06","F1"):1.5, ("06","F2"):1.5, ("06","F3"):1.5,
    ("06","P1"):1.5, ("06","P2"):1.5,
    ("07","M1"):1.5, ("07","M2"):1.5, ("07","M3"):1.5,
    ("07","M4"):1.5, ("07","M5"):1.5, ("07","M6"):1.5, ("07","M7"):1.5, ("07","M8"):1.5,
    ("07","P1"):1.5, ("07","P2"):1.5, ("07","P3"):1.5,
    ("07","P4"):1.5, ("07","P5"):1.5, ("07","P6"):1.5, ("07","P7"):1.5,
    ("07","P8"):1.5, ("07","P9"):1.5, ("07","Q1"):1.5, ("07","Q2"):1.5, ("07","Q3"):1.5,
    ("09","B1"):1.5, ("09","B2"):1.5,
    ("09","C1"):1.5, ("09","C2"):1.5, ("09","C3"):1.5,
    ("09","E1"):2.0, ("09","E2"):2.0, ("09","E3"):2.0, ("09","E4"):2.0,
    ("09","P1"):1.5, ("09","P2"):1.5, ("09","P3"):1.5,
    ("09","P4"):1.5, ("09","P5"):1.5, ("09","P6"):1.5, ("09","P7"):1.5, ("09","P8"):1.5,
    ("09","R1"):1.5, ("09","R2"):1.5, ("09","T1"):1.5,
    ("10","F01"):1.5, ("10","F02"):1.5, ("10","F03"):1.5, ("10","F04"):1.5,
    ("10","F05"):1.5, ("10","F06"):1.5, ("10","F08"):1.5,
    ("10","F09"):1.5, ("10","F10"):1.5, ("10","F11"):1.5, ("10","F12"):1.5,
    ("10","F13"):1.5, ("10","F14"):1.5, ("10","F15"):1.5, ("10","F16"):1.5,
    ("10","V01"):1.5, ("10","V02"):1.5, ("10","V03"):1.5,
    ("10","V04"):1.5, ("10","V05"):1.5, ("10","V06"):1.5,
    ("10","V07"):1.5, ("10","V08"):1.5, ("10","V09"):1.5,
    ("10","C01"):1.5,
    ("10","P01"):1.5, ("10","P02"):1.5, ("10","P03"):1.5,
    ("10","P04"):1.5, ("10","P05"):1.5, ("10","P06"):1.5,
    ("10","P07"):1.5, ("10","P08"):1.5, ("10","P09"):1.5,
    ("10","P10"):1.5, ("10","P11"):1.5, ("10","P12"):1.5,
    ("10","P13"):1.5, ("10","P14"):1.5, ("10","P15"):1.5,
    ("10","OV1"):1.5, ("10","OV10"):1.5, ("10","OV2"):1.5, ("10","OV3"):1.5,
    ("10","OV4"):1.5, ("10","OV5"):1.5, ("10","OV6"):1.5,
    ("10","OV7"):1.5, ("10","OV8"):1.5, ("10","OV9"):1.5,
    ("13","01"):1.5, ("13","02"):1.5, ("13","03"):1.5,
    ("13","04"):1.5, ("13","05"):1.5, ("13","06"):1.5, ("13","07"):1.5,
    ("15","SEL01"):1.5, ("15","SEL02"):1.5, ("15","SEL03"):1.5,
    ("15","SEL04"):1.5, ("15","SEL05"):1.5, ("15","SEL06"):1.5, ("15","SEL07"):1.5,
    ("15","SEL08"):2.0, ("15","SEL09"):2.0, ("15","SEL10"):2.0,
    ("15","SEL11"):2.0, ("15","SEL12"):2.0, ("15","SEL13"):2.0,
    ("16","SHS01"):1.5, ("16","SHS02"):1.5, ("16","SHS03"):1.5,
    ("16","SHS04"):1.5, ("16","SHS05"):1.5, ("16","SHS06"):1.5,
    ("16","SHS07"):1.5, ("16","SHS08"):1.5, ("16","SHS09"):1.5,
    ("16","SHS10"):1.5, ("16","SHS11"):1.5, ("16","SHS12"):1.5,
    ("16","SHS15"):1.5, ("16","SHS17"):2.0, ("16","SHS18"):2.0,
    ("16","SHS19"):2.0, ("16","SHS20"):2.0, ("16","SHS21"):2.0,
}

CATEGORY_CONCEPTOS = {
    "03 01 CIMENTACION PILAS Y PILOTES": 170,
    "03 02 CIMENTACION ZAPATAS":         80,
    "03 03 CIMENTACION CONTRATRABES":    40,
    "03 05 CIMENTACION VARIOS":          60,
    "04 01 ESTRUCTURA COLUMNAS Y MUROS": 17,
    "04 02 ESTRUCTURA TRABES Y LOSAS":   32,
    "05 01 ESTRUCTURA METALICA":         60,
    "06 01 ALBAÑILERIA CASTILLOS":       69,
    "06 02 ALBAÑILERIA MUROS":           40,
    "06 03 ALBAÑILERIA DALAS":           43,
    "06 04 ALBAÑILERIA REGISTROS":       20,
    "06 05 ALBAÑILERIA APLANADOS":       78,
    "06 10 ALBAÑILERIA VARIOS":          30,
    "07 01 MUROS Y PLAFONES":            20,
    "09 01 HERRERIA":                    56,
    "10 01 ALUMINIO FIJOS":              31,
    "10 02 ALUMINIO CORREDIZOS":         25,
    "10 03 ALUMINIO BATIENTES":          47,
    "10 04 ALUMINIO PROYECCION":         10,
    "13 07 MAMPARAS SANILOCK":           10,
    "15 05 SALIDAS ELECTRICAS":         113,
    "16 05 SALIDAS HIDROSANITARIAS CU-PVC": 152,
}

# ---- Balanced quotas per category ----
# Each category gets a minimum allocation from the 70 slots
# Core structural categories get more; finish/specialty get fewer
TOTAL_SLOTS = 100

CATEGORY_QUOTAS = {
    "03 01 CIMENTACION PILAS Y PILOTES":    2,
    "03 02 CIMENTACION ZAPATAS":            5,
    "03 03 CIMENTACION CONTRATRABES":       4,
    "03 05 CIMENTACION VARIOS":             4,
    "04 01 ESTRUCTURA COLUMNAS Y MUROS":     4,
    "04 02 ESTRUCTURA TRABES Y LOSAS":       4,
    "05 01 ESTRUCTURA METALICA":             4,
    "06 01 ALBAÑILERIA CASTILLOS":           5,
    "06 02 ALBAÑILERIA MUROS":               4,
    "06 03 ALBAÑILERIA DALAS":               4,
    "06 04 ALBAÑILERIA REGISTROS":           3,
    "06 05 ALBAÑILERIA APLANADOS":           5,
    "06 10 ALBAÑILERIA VARIOS":              4,
    "07 01 MUROS Y PLAFONES":                4,
    "09 01 HERRERIA":                        4,
    "10 01 ALUMINIO FIJOS":                  5,
    "10 02 ALUMINIO CORREDIZOS":             4,
    "10 03 ALUMINIO BATIENTES":              5,
    "10 04 ALUMINIO PROYECCION":             4,
    "13 07 MAMPARAS SANILOCK":               4,
    "15 05 SALIDAS ELECTRICAS":              5,
    "16 05 SALIDAS HIDROSANITARIAS CU-PVC":   5,
}

def get_code(nombre):
    parts = nombre.split()
    if parts[0].isdigit() and len(parts) > 1 and parts[1].isdigit():
        return parts[1]
    return parts[0]

def get_cat_prefix(clave_neodata):
    return clave_neodata.split()[0]

def get_cat_short(clave_neodata):
    """Extract short category name like 'PILAS Y PILOTES'"""
    parts = clave_neodata.split(" ", 2)
    return parts[2] if len(parts) >= 3 else clave_neodata

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT id, clave_neodata, nombre FROM intelimats_catalog ORDER BY clave_neodata, nombre")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Score each intelimat
    all_items = []
    for id_, clave_neodata, nombre in rows:
        code = get_code(nombre)
        cat_prefix = get_cat_prefix(clave_neodata)
        phase_weight = PHASE_WEIGHTS.get(cat_prefix, 30)
        complexity = COMPLEXITY.get((cat_prefix, code), 1.0)
        n_conc = CATEGORY_CONCEPTOS.get(clave_neodata, 10)
        coverage = 1.0 + math.log10(max(n_conc, 1))
        score = round(phase_weight * complexity * coverage, 1)

        all_items.append({
            "clave_neodata": clave_neodata,
            "nombre": nombre,
            "code": code,
            "cat_prefix": int(cat_prefix),
            "cat_short": get_cat_short(clave_neodata),
            "phase_weight": phase_weight,
            "complexity": complexity,
            "n_conceptos_est": n_conc,
            "score": score,
        })

    # Group by category
    by_cat = defaultdict(list)
    for item in all_items:
        by_cat[item["clave_neodata"]].append(item)

    # Sort each category's items by score descending
    for cat, items in by_cat.items():
        items.sort(key=lambda x: -x["score"])

    # --- Balanced selection ---
    selected = []
    # First pass: allocate quota per category (take top N from each)
    for cat, quota in CATEGORY_QUOTAS.items():
        items = by_cat.get(cat, [])
        selected.extend(items[:quota])

    # Second pass: if we have fewer than 70, fill remaining with highest-scoring unselected
    selected_ids = {s["nombre"] for s in selected}
    remaining = [item for item in all_items if item["nombre"] not in selected_ids]
    remaining.sort(key=lambda x: -x["score"])

    slots_left = TOTAL_SLOTS - len(selected)
    selected.extend(remaining[:slots_left])

    # Sort final list by score descending
    selected.sort(key=lambda x: (-x["score"], x["clave_neodata"], x["nombre"]))
    for i, item in enumerate(selected):
        item["rank"] = i + 1

    # --- Print ---
    print(f"{'Rank':>4} {'Score':>7} {'Ph':>3} {'Cx':>4} {'Conc':>5} {'Code':<8} {'Category':<32} {'Intelimat'}")
    print("=" * 120)
    for r in selected:
        print(f"{r['rank']:>4} {r['score']:>7.1f} {r['phase_weight']:>3} {r['complexity']:>4.1f} "
              f"{r['n_conceptos_est']:>5} {r['code']:<8} {r['cat_short']:<32} {r['nombre']:<55}")

    # Category distribution
    cat_counts = Counter(r["cat_short"] for r in selected)
    print(f"\n--- Balanced Top {TOTAL_SLOTS} by Category ---")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")
    print(f"  Total: {sum(cat_counts.values())}")

    # Write CSVs
    outdir = "/Users/rodrigomedinagarcia/Documents/Development/costbase"
    with open(f"{outdir}/intelimat_top{TOTAL_SLOTS}_balanced.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rank", "score", "cat_prefix", "phase_weight", "complexity",
                     "n_conceptos_est", "clave_neodata", "cat_short", "code", "nombre"])
        for r in selected:
            w.writerow([r["rank"], r["score"], r["cat_prefix"], r["phase_weight"],
                        r["complexity"], r["n_conceptos_est"],
                        r["clave_neodata"], r["cat_short"], r["code"], r["nombre"]])
    print(f"\nWritten: {outdir}/intelimat_top{TOTAL_SLOTS}_balanced.csv")

    # Also write the full ranked list (unbalanced) for comparison
    all_items.sort(key=lambda x: (-x["score"], x["clave_neodata"], x["nombre"]))
    for i, item in enumerate(all_items):
        item["rank_all"] = i + 1
    with open(f"{outdir}/intelimat_priority_ranking.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rank", "score", "cat_prefix", "phase_weight", "complexity",
                     "n_conceptos_est", "clave_neodata", "cat_short", "code", "nombre"])
        for r in all_items:
            w.writerow([r["rank_all"], r["score"], r["cat_prefix"], r["phase_weight"],
                        r["complexity"], r["n_conceptos_est"],
                        r["clave_neodata"], r["cat_short"], r["code"], r["nombre"]])
    print(f"Written: {outdir}/intelimat_priority_ranking.csv")

if __name__ == "__main__":
    main()
