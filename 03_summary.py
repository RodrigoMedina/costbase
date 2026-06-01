import pandas as pd

print("=" * 70)
print("COSTBASE MX — DATA SUMMARY FROM NEODATA CONSTRUBASE")
print("=" * 70)

# 1. Budgets
budgets = pd.read_csv("extracted_data/budgets.csv")
print("\n1. MASTER FILES (4 budgets)")
print("-" * 40)
for _, r in budgets.iterrows():
    print(f"   [{r['IdPresupuesto']}] {r['Presupuesto']}")

# 2. Partidas
partidas = pd.read_csv("extracted_data/partidas.csv")
print(f"\n2. PARTIDAS (work chapters): {len(partidas):,} total")
print("-" * 40)
root_nodes = partidas[partidas["IdPartidaPadre"].isna() | (partidas["IdPartidaPadre"] == 0)]
print(f"   Root nodes (top-level): {len(root_nodes)}")
for _, r in root_nodes.iterrows():
    desc = (str(r["DescripcionPartidaLarga"])[:60] if pd.notna(r["DescripcionPartidaLarga"]) else str(r["DescripcionPartida"])[:60])
    print(f"     [{r['IdPresupuesto']}] {r['Partida']} - {desc}")
print(f"   Avg partidas per budget: {len(partidas) / budgets['IdPresupuesto'].nunique():.0f}")

# 3. Catalog
catalog = pd.read_csv("extracted_data/catalog.csv")
types = pd.read_csv("extracted_data/insumo_types.csv")
print(f"\n3. CATALOG (all items): {len(catalog):,} total")
print("-" * 40)
type_map = dict(zip(types["IdTipo"], types["Descripcion"]))
catalog["TipoDesc"] = catalog["IdTipo"].map(type_map)
tipo_counts = catalog["TipoDesc"].value_counts()
for tipo, count in tipo_counts.items():
    label = tipo if pd.notna(tipo) else "SIN TIPO"
    print(f"   {label:30s} {count:>8,}")
print(f"   {'TOTAL':30s} {len(catalog):>8,}")

has_price = catalog["InsumoDescontinuado"].value_counts()
print(f"\n   Active items: {len(catalog[catalog['InsumoDescontinuado'] != 1]):,}")
print(f"   Discontinued: {len(catalog[catalog['InsumoDescontinuado'] == 1]):,}")

# 4. Units
units = pd.read_csv("extracted_data/units.csv")
print(f"\n4. UNITS: {len(units)}")
print("-" * 40)
for _, r in units.head(20).iterrows():
    print(f"   [{r['IdUnidad']:2d}] {r['Unidad']:8s} - {r['Descripcion']}")
if len(units) > 20:
    print(f"   ... and {len(units) - 20} more")

# 5. Families
families = pd.read_csv("extracted_data/families.csv")
print(f"\n5. FAMILIES: {len(families)}")
print("-" * 40)
for _, r in families.iterrows():
    print(f"   [{r['idFamilia']:2d}] {r['Familia']:15s} - {r['Descripcion']}")

# 6. Matrices
matrices = pd.read_csv("extracted_data/matrices.csv")
print(f"\n6. MATRICES (unit price compositions): {len(matrices):,}")
print("-" * 40)
unique_concepts = matrices["IdCodigoMatriz"].nunique()
unique_insumos = matrices["IdCodigoInsumo"].nunique()
print(f"   Unique conceptos in matrices: {unique_concepts:,}")
print(f"   Unique insumos in matrices: {unique_insumos:,}")
print(f"   Avg insumos per concepto: {len(matrices) / unique_concepts:.1f}")
print(f"   Avg concepts per insumo: {len(matrices) / unique_insumos:.1f}")

# 7. ExpinsXconcepto (alternative matrix view)
expins_x = pd.read_csv("extracted_data/expins_x_concepto.csv")
print(f"\n7. EXPINS_X_CONCEPTO: {len(expins_x):,}")
print("-" * 40)
unique_concepts_x = expins_x["IdCodigoMatriz"].nunique()
unique_insumos_x = expins_x["IdCodigoInsumo"].nunique()
print(f"   Unique conceptos: {unique_concepts_x:,}")
print(f"   Unique insumos: {unique_insumos_x:,}")

# 8. Conceptos per budget
conceptos = pd.read_csv("extracted_data/conceptos.csv")
print(f"\n8. CONCEPTOS (per budget): {len(conceptos):,} total")
print("-" * 40)
conc_by_budget = conceptos.groupby("IdPresupuesto").size()
for pid, count in conc_by_budget.items():
    bname = budgets[budgets["IdPresupuesto"] == pid]["Presupuesto"].values[0] if pid in budgets["IdPresupuesto"].values else "?"
    print(f"   [{pid}] {bname:30s} {count:>6,} conceptos")

# 9. Costs (prices)
costs = pd.read_csv("extracted_data/costs.csv")
print(f"\n9. COSTS (prices): {len(costs):,} total")
print("-" * 40)
print(f"   Unique ExpIns with costs: {costs['IdExpIns'].nunique():,}")
print(f"   Cost range: ${costs['Costo'].min():.2f} - ${costs['Costo'].max():.2f}")
print(f"   Median cost: ${costs['Costo'].median():.2f}")
print(f"   Date range: {costs['Fecha'].min()} to {costs['Fecha'].max()}")

# 10. Intelimats
intelimats = pd.read_csv("extracted_data/intelimats.csv")
print(f"\n10. INTELIMATS: {len(intelimats)}")
print("-" * 40)
for _, r in intelimats.iterrows():
    print(f"     {r['Partida']:15s} {r['InteliMat'][:50]}")

print("\n" + "=" * 70)
print("END OF SUMMARY")
print("=" * 70)
