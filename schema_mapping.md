# Schema Mapping: Neodata ConstruBase → CostBase MX

## Source: SQL Server (ConstruBase_Mayo_2026)

The source is a Microsoft SQL Server `.mdf` file attached via Docker. Table names are the actual SQL Server names from the ConstruBase database.

## Entity Mapping

| CostBase MX Table | Neodata Source | Join Key | Row Count | Notes |
|---|---|---|---|---|
| `regiones` | Static reference | — | 11 | Hardcoded in schema.sql (not extracted) |
| `partidas` | `dbo.PuPartidas` (via `PuPresupuestosPartidas`) | `IdPresupuestoPartida` | 1,385 → 351 deduped | 4 budgets (48-51) with identical structure → merged via `tiers[]` |
| `insumos` | `dbo.PuCatalogo` filtered to `IdCodigoInsumo` in `PuMatrices` | `IdCodigo` | 18,422 | Items that appear as `IdCodigoInsumo` in matrices |
| `conceptos` | `dbo.PuCatalogo` filtered to `IdCodigoMatriz` in `PuMatrices` | `IdCodigo` | 20,306 | Items that appear as `IdCodigoMatriz` in matrices |
| `matrices` | `dbo.PuMatrices` | `IdCodigoMatriz` → `IdExpIns` → `IdCodigo` | 105,206 | 419K raw → deduped via `(concepto_id, insumo_id, nivel)` |
| `precios` | `dbo.PuCostos` (`PuCostosInsumos`) | `IdExpIns` → `IdCodigo` | 75,234 | Only for items classified as insumos |
| `intelimats_catalog` | `dbo.PuIntelimats` | — | 229 | Phase 3 — not implemented |

## Column Mapping Detail

### partidas

| CostBase Column | Neodata Column | Source Table | Notes |
|---|---|---|---|
| `id` | — | — | Generated UUID (deterministic per code) |
| `clave_neodata` | `Partida` | `PuPartidas` | Partida code (e.g. "104", "10401") |
| `nombre` | `DescripcionPartida` / `DescripcionPartidaLarga` | `PuPartidas` | Canonical from budget 48 (constructor) |
| `padre_id` | `IdPartidaPadre` | `PuPartidas` | Joined via `IdPresupuestoPartida` within same budget |
| `orden` | `Renglon` | `PuPartidas` | |
| `tiers` | `IdPresupuesto` | `PuPresupuestosPartidas` | Array of budget names: constructor, concursos, remodelador, desarrollador |
| `path` | — | — | Computed via recursive CTE |

### insumos

| CostBase Column | Neodata Column | Source Table | Notes |
|---|---|---|---|
| `id` | — | — | Generated UUID |
| `clave_neodata` | `Codigo` | `PuCatalogo` | Original Neodata code |
| `nombre` | `DescripcionLarga` / `Descripcion` | `PuCatalogo` | |
| `unidad` | `Unidad` (via `PuUnidades`) | `PuCatalogo` | FK to `IdUnidad` |
| `tipo` | `IdTipo` | `PuCatalogo` | 1→material, 2→mano_obra, 3→maquinaria, 4→basico_obra, 5→subcontrato |
| `familia` | `Familia` (via `PuFamilias`) | `PuCatalogo` | |
| `embedding` | — | — | Generated via OpenAI `text-embedding-3-small` |

### conceptos

| CostBase Column | Neodata Column | Source Table | Notes |
|---|---|---|---|
| `id` | — | — | Generated UUID |
| `clave_neodata` | `Codigo` | `PuCatalogo` | Same catalog as insumos, different filter |
| `nombre` | `DescripcionLarga` / `Descripcion` | `PuCatalogo` | |
| `unidad` | `Unidad` (via `PuUnidades`) | `PuCatalogo` | |
| `partida_id` | `IdPresupuestoPartida` | `PuPresupuestosConceptos` | Links via budget 48 hierarchy |
| `tier` | `IdPresupuesto` | `PuPresupuestosConceptos` | Array of budgets this concept appears in |
| `embedding` | — | — | Generated via OpenAI |

### matrices

| CostBase Column | Neodata Column | Source Table | Notes |
|---|---|---|---|
| `id` | — | — | Generated UUID |
| `concepto_id` | `IdCodigoMatriz` → `IdExpIns` → `IdCodigo` | `PuMatrices` → `PuExpIns` | Two-hop join via ExpIns |
| `insumo_id` | `IdCodigoInsumo` → `IdExpIns` → `IdCodigo` | `PuMatrices` → `PuExpIns` | Same two-hop join |
| `cantidad` | `Volumen` | `PuMatrices` | Raw volume from matrix |
| `orden` | `Renglon` | `PuMatrices` | Display order in matrix |

### precios

| CostBase Column | Neodata Column | Source Table | Notes |
|---|---|---|---|
| `id` | — | — | Generated UUID |
| `insumo_id` | `IdExpIns` → `IdCodigo` | `PuCostosInsumos` → `PuExpIns` | |
| `region_id` | — | — | Hardcoded to 1 (Valle de México) |
| `tier` | `IdPresupuesto` | Derived from ExpIns link | constructor/concursos/remodelador/desarrollador |
| `precio` | `Costo` | `PuCostosInsumos` | |
| `moneda` | `IdMoneda` | `PuCostosInsumos` | 1 = MXN |
| `fuente_tipo` | — | — | Hardcoded to 'neodata_seed' |
| `confianza` | — | — | Hardcoded to 0.60 |
| `fecha` | `Fecha` | `PuCostosInsumos` | |

## Key Transformation Rules

1. **Catalog split**: A single `PuCatalogo` (178K items) is split into `insumos` and `conceptos` based on whether the item's `IdCodigo` appears as `IdCodigoMatriz` (concepto) or `IdCodigoInsumo` (insumo) in `PuMatrices`. Items can be in both — the load script tests conceptos first, so dual-role items land in conceptos.

2. **ExpIns indirection**: `PuMatrices` references items via `PuExpIns.IdExpIns` (not `PuCatalogo.IdCodigo`). Each budget has its own set of ExpIns entries. The pipeline joins through `PuExpIns` to resolve to catalog IDs, then applies the unified UUID map.

3. **Partida dedup**: 4 budgets (48-51) each have identical partida hierarchies. These are merged into a single row per code with a `tiers[]` array. The constructor budget (48) serves as canonical for descriptions and parent relationships.

4. **Price tier assignment**: Prices are extracted from `PuCostosInsumos` which is keyed by `IdExpIns`. Since each budget has separate ExpIns entries, the budget ID is recovered via the ExpIns join, enabling 4-tier pricing (constructor, concursos, remodelador, desarrollador).

## Data Flow

```
.mdf (SQL Server)
  │  docker/mssql
  ▼
02_extract.py ───→ extracted_data/*.csv  (intermediate CSVs)
  │
  ▼
04_load_to_neon.py ───→ Neon PostgreSQL
  │
  ├── partidas: dedup 4 budgets → 351 unique with tiers[]
  ├── insumos: catalog items appearing as IdCodigoInsumo
  ├── conceptos: catalog items appearing as IdCodigoMatriz
  ├── matrices: composition via ExpIns resolution
  ├── precios: insumo-level costs, filtered to insumo catalog
  └── intelimats_catalog: 229 items catalogued only
  │
  ▼
05_generate_embeddings.py ───→ OpenAI API → vector(1536) stored in DB
  │
  ▼
search.py  ───→ semantic search CLI
```
