import pymssql
import pandas as pd
import os
from pathlib import Path

OUT_DIR = Path("extracted_data")
OUT_DIR.mkdir(exist_ok=True)

print("Connecting to SQL Server...")
conn = pymssql.connect(
    server="localhost",
    user="sa",
    password="CostBase123!",
    database="ConstruBase",
)

def extract(query, name):
    print(f"  Extracting {name}...")
    df = pd.read_sql(query, conn)
    path = OUT_DIR / f"{name}.csv"
    df.to_csv(path, index=False)
    print(f"    -> {len(df):,} rows -> {path}")
    return df

# 1. Budgets (4 master files)
budgets = extract("SELECT IdPresupuesto, Presupuesto, Nombre FROM PuPresupuestos", "budgets")

# 2. Partidas (hierarchical work chapters)
partidas = extract("""
    SELECT pp.IdPresupuestoPartida, pp.IdPresupuesto, pp.IdPartidaPadre,
           pp.Partida, pp.DescripcionPartida, pp.DescripcionPartidaLarga, pp.Renglon
    FROM PuPresupuestosPartidas pp
    ORDER BY pp.IdPresupuesto, pp.Renglon
""", "partidas")

# 3. Insumo types
types = extract("SELECT IdTipo, Descripcion FROM PuTipoInsumos", "insumo_types")

# 4. Units
units = extract("SELECT IdUnidad, Unidad, Descripcion FROM PuUnidades", "units")

# 5. Catalog items (all codes: insumos + conceptos)
catalog = extract("""
    SELECT c.IdCodigo, c.Codigo, c.Descripcion, c.DescripcionLarga,
           c.IdTipo, c.IdUnidad, c.IdFamilia, c.Referencia,
           c.EsPorcentaje, c.InsumoDescontinuado
    FROM PuCatalogo c
    ORDER BY c.IdCodigo
""", "catalog")

# 6. Families
families = extract("SELECT idFamilia, Familia, Descripcion FROM PuFamilias", "families")

# 7. ExpIns (exported items per budget, linking catalog to budgets)
expins = extract("""
    SELECT e.IdExpIns, e.IdPresupuesto, e.IdCodigo,
           e.Expins, e.Nivel, e.ExpInsl, e.InsumoIntegrado,
           e.CodMaestro, e.IdPresupuestoPartida
    FROM PuExpIns e
    ORDER BY e.IdExpIns
""", "expins")

# 8. Conceptos (per budget, per partida)
conceptos = extract("""
    SELECT pc.IdPresupuestoConcepto, pc.IdPresupuesto, pc.IdPresupuestoPartida,
           pc.IdExpIns, pc.Control, pc.Renglon, pc.Cantidad, pc.CantidadTotal
    FROM PuPresupuestosConceptos pc
    ORDER BY pc.IdPresupuesto, pc.IdPresupuestoPartida, pc.Renglon
""", "conceptos")

# 9. Matrices (unit price compositions)
matrices = extract("""
    SELECT m.IdMatriz, m.IdCodigoMatriz, m.Renglon,
           m.IdCodigoInsumo, m.Dividir, m.Volumen, m.Expresion
    FROM PuMatrices m
    ORDER BY m.IdCodigoMatriz, m.Renglon
""", "matrices")

# 10. ExpinsXconcepto (alternative matrix view)
expins_x_concepto = extract("""
    SELECT x.IdExpinsXconcepto, x.IdCodigoMatriz, x.IdCodigoInsumo, x.Volumen
    FROM PuExpinsXconcepto x
    ORDER BY x.IdCodigoMatriz
""", "expins_x_concepto")

# 11. Costs (prices)
costs = extract("""
    SELECT ec.IdExpInsCosto, ec.IdExpIns, ec.IdMoneda,
           ec.Costo, ec.Fecha
    FROM PuExpInsCostos ec
    ORDER BY ec.IdExpIns, ec.Fecha DESC
""", "costs")

# 12. Intelimats (catalog only)
intelimats = extract("""
    SELECT i.IdInteliMat, i.Partida, i.InteliMat, i.Cadena,
           i.Autor, i.Fecha, i.EsNeodata, i.EsLibre
    FROM PuIntelimat i
""", "intelimats")

conn.close()

print("\nDone! Extracted files:")
for f in sorted(OUT_DIR.iterdir()):
    size = f.stat().st_size / 1024 / 1024
    print(f"  {f.name}: {size:.1f} MB")
