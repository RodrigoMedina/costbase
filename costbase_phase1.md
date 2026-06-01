# CostBase MX — Phase 1: Neodata Extraction & Migration

**Status:** Pre-development  
**Priority:** CRITICAL — blocks all subsequent phases  
**Estimated duration:** 2–3 weeks  
**Owner:** ThinkParametric / FastRender  
**Version:** 1.0 — June 2025  

---

## Table of Contents

1. [Objective](#1-objective)
2. [Context: What Neodata ConstruBase Contains](#2-context-what-neodata-construbase-contains)
3. [Legal Considerations](#3-legal-considerations)
4. [Deliverables](#4-deliverables)
5. [Prerequisites & Environment Setup](#5-prerequisites--environment-setup)
6. [Step-by-Step Extraction Process](#6-step-by-step-extraction-process)
7. [Target Database Schema (PostgreSQL)](#7-target-database-schema-postgresql)
8. [Extraction Scripts](#8-extraction-scripts)
9. [Embedding Generation](#9-embedding-generation)
10. [Data Validation](#10-data-validation)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Known Risks & Mitigations](#12-known-risks--mitigations)

---

## 1. Objective

Extract the complete structural knowledge from Neodata ConstruBase and migrate it into a modern PostgreSQL + pgvector schema. At the end of this phase, the database will contain:

- The full hierarchical taxonomy of Mexican construction work (partidas tree)
- All 23,393 catalogued inputs (insumos): materials, labor, machinery
- All 10,263 unit price matrices (precios unitarios) with their compositions
- Seed prices for Region 1 (Valle de México) as a starting point
- Semantic embeddings for every insumo and concepto to enable natural-language search

> **What this phase does NOT include:** Real-time price updates (Phase 2), Intelimat engine (Phase 3), or public API (Phase 4). Phase 1 is purely data extraction, transformation, and loading (ETL).

---

## 2. Context: What Neodata ConstruBase Contains

Neodata ConstruBase is the de-facto standard for construction cost estimation in Mexico. Understanding its structure is required before writing a single line of extraction code.

### 2.1 Hierarchical Structure (6 levels)

```
Level 1 → Catalog / Master File
  Level 2 → Partidas (Work chapters)
    Level 3 → Subpartidas (Sub-chapters)
      Level 4 → Conceptos (Unit prices)
        Level 5 → Matrices (Direct cost breakdown)
          Level 6 → Insumos (Materials / Labor / Equipment)
```

### 2.2 Key Entities and Record Counts

| Entity | Count | Description |
|--------|-------|-------------|
| Insumos (inputs) | 23,393 | Individual materials, labor categories, and equipment items with price |
| Matrices (unit price compositions) | 10,263 | Full breakdown of how each unit price is assembled from inputs |
| Intelimats (parametric matrices) | 229 | Smart matrices with configurable parameters — NOT extracted in this phase; catalogued only |
| Price regions | 11 | Geographic zones of Mexico with distinct pricing |
| Master files | 4 | Constructor, Desarrollador, Remodelador, Concursos |

### 2.3 The 4 Master Files

| Master File | Target User | Key Characteristic |
|-------------|-------------|-------------------|
| Constructor | Small companies | Standard market prices, moderate margins |
| Desarrollador | Large builders | Volume pricing, lower input costs |
| Remodelador | Renovation contractors | Retail purchases, minor works |
| Concursos | Public tenders | Low prices + optimal labor yields |

### 2.4 The 11 Price Regions

| # | Region | Key States |
|---|--------|-----------|
| 1 | Valle de México | CDMX, Estado de México, Hidalgo |
| 2 | Norte | Chihuahua, Sonora, Sinaloa, Durango |
| 3 | Noreste | Nuevo León, Coahuila, Tamaulipas |
| 4 | Noroeste | Baja California, Baja California Sur |
| 5 | Occidente | Jalisco, Colima, Nayarit, Aguascalientes |
| 6 | Bajío | Guanajuato, Querétaro, Michoacán, San Luis Potosí |
| 7 | Centro-Sur | Morelos, Guerrero, Puebla, Tlaxcala |
| 8 | Sur | Oaxaca, Chiapas |
| 9 | Sureste | Veracruz, Tabasco |
| 10 | Península | Yucatán, Campeche, Quintana Roo |
| 11 | Pacífico Centro | Michoacán Costa, Guerrero Norte |

> **Important:** Region 1 prices are available in the free desktop version. Prices for all 11 regions require a paid Nube+ license. Phase 1 extracts Region 1 as seed data; Phase 2 will populate all 11 regions via AI agents scraping live market sources.

### 2.5 Input (Insumo) Types

| Type Code | Type | Examples |
|-----------|------|---------|
| `M` | Material | Cement, steel rebar, brick, PVC pipe, electrical wire |
| `J` | Labor (Jornal) | Mason, ironworker, plumber, electrician, laborer |
| `E` | Equipment | Concrete mixer, backhoe, scaffolding, crane |
| `%` | Tools | Percentage factor applied over labor cost |
| `SC` | Subcontract | Fully subcontracted work packages |
| `B` | Basic compound | Composite input (e.g., 1:4 mortar mix) |

---

## 3. Legal Considerations

> **This section must be read before starting extraction.**

The following analysis is for internal planning purposes only. Consult a Mexican IP attorney before any commercial redistribution.

### What is NOT protectable by Neodata

- **The taxonomy of partidas** (construction work categories): "Cimentación", "Estructura", "Instalaciones" are industry terms dictated by how construction actually works, documented in multiple public sources (IMSS catalogs, INFONAVIT, Ley de Obras Públicas, CSI MasterFormat). Multiple independent organizations have arrived at the same taxonomy.
- **Technical facts** (engineering quantities): that 1 m³ of concrete requires specific amounts of cement, water, and aggregate is a fact of material science, not Neodata's invention.
- **Labor yields** (rendimientos): documented in public CMIC manuals, IMSS standards, and engineering literature.

### What IS protectable

- The **exact wording** of concept descriptions (creative expression)
- The **specific numbering scheme** (01.02.003) as a particular expression
- The **Intelimat software** (clearly proprietary software, not extracted in Phase 1)
- The **compiled database as a whole** (potentially as a collective work)

### Mitigation strategy for Phase 1

1. **Rewrite all descriptions** using AI after extraction — generate original text in CostBase MX's own voice, not copied from Neodata
2. **Use our own numbering system** — do not replicate Neodata's clave format
3. **The tree structure** is rebuilt from industry-standard sources (IMSS, INFONAVIT, CONAVI), using Neodata as a reference, not a copy
4. **Technical quantities** in matrices are cross-referenced against public NTC-CDMX, ACI 318, and CMIC manuals

---

## 4. Deliverables

| # | Deliverable | Format | Owner |
|---|-------------|--------|-------|
| D1 | Schema mapping document: Neodata tables → CostBase MX tables | Markdown | Engineer |
| D2 | Python extraction script with full error handling | `.py` | Engineer |
| D3 | PostgreSQL migration with all tables, indexes, and constraints | `.sql` | Engineer |
| D4 | Validated data: record counts matching targets | Test report | Engineer |
| D5 | Embedding generation batch script | `.py` | Engineer |
| D6 | Integrity validation report (0 broken foreign keys) | JSON report | Engineer |
| D7 | Rewritten descriptions for all insumos (AI-generated original text) | DB update | AI agent |

---

## 5. Prerequisites & Environment Setup

### 5.1 Windows Environment (for Neodata)

Neodata only runs on Windows. This step must be done on a Windows machine or VM.

```
1. Download Neodata PU Win+ (free version) from neodata.mx
2. Install in default location (C:\Neodata2021Obras\)
3. On first launch: Archivo > Importar > Maestros > ConstruBase
4. Wait for ConstruBase import to complete (~5-10 minutes)
5. Locate the database file:
   - Neodata 2021+: C:\Neodata2021Obras\Data\ (look for .db or .sdf file)
   - Neodata 2018:  C:\ProgramData\Neodata\ (look for .mdb file)
6. Copy the database file to a safe backup location before any work
```

### 5.2 Database Explorer Setup

```bash
# Install DBeaver Community (free, cross-platform)
# Download from: dbeaver.io

# For SQLite (.db files):
# DBeaver > New Connection > SQLite > point to the file

# For SQL Server Compact (.sdf files):
# DBeaver > New Connection > SQL Server Compact > point to the file
# May require Microsoft SQL Server Compact 4.0 SP1 runtime
```

### 5.3 Python Environment

```bash
# Requires Python 3.10+
pip install sqlite3        # usually built-in
pip install pyodbc         # for .sdf / SQL Server Compact files
pip install pandas==2.2.0
pip install sqlalchemy==2.0.0
pip install psycopg2-binary==2.9.9
pip install pydantic==2.6.0
pip install openai==1.30.0  # for embedding generation
pip install rich==13.7.0    # for progress bars and logging
pip install python-dotenv
```

### 5.4 Target PostgreSQL Setup

```bash
# Using Docker for local development
docker run -d \
  --name costbase-db \
  -e POSTGRES_PASSWORD=costbase \
  -e POSTGRES_DB=costbase_mx \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Verify pgvector extension is available
psql -U postgres -d costbase_mx -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 5.5 Environment Variables

```bash
# .env
NEODATA_DB_PATH="C:\\Neodata2021Obras\\Data\\ConstruBase.db"
NEODATA_DB_TYPE="sqlite"  # or "sqlserver_compact"

POSTGRES_DSN="postgresql://postgres:costbase@localhost:5432/costbase_mx"

OPENAI_API_KEY="sk-..."   # for embedding generation
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
OPENAI_EMBEDDING_DIMS=1536
```

---

## 6. Step-by-Step Extraction Process

### Step 1: Discover the Real Schema

Before writing any extraction code, map the actual Neodata table names. They are internal and not documented.

```python
# discover_schema.py
import sqlite3
import pandas as pd

conn = sqlite3.connect("ConstruBase.db")

# List ALL tables
tables = pd.read_sql(
    "SELECT name, type FROM sqlite_master WHERE type='table' ORDER BY name",
    conn
)
print("=== ALL TABLES ===")
print(tables.to_string(index=False))

# For each table, show column names, types, and 3 sample rows
for table_name in tables['name'].tolist():
    try:
        df = pd.read_sql(f"SELECT * FROM [{table_name}] LIMIT 3", conn)
        print(f"\n=== {table_name} ({len(df.columns)} columns, sample) ===")
        print(df.dtypes.to_string())
        print(df.to_string(index=False))
    except Exception as e:
        print(f"\n{table_name}: ERROR - {e}")

conn.close()
```

> **Expected output:** A list of 15–30 tables. Look for tables whose names suggest: insumos, conceptos, partidas, matrices, precios, unidades, regiones. The actual names may be in Spanish with abbreviations (e.g., `Ins`, `Cat`, `Mat`, `PU`).

### Step 2: Map Neodata Tables to CostBase MX Entities

After running the schema discovery, fill in this mapping table:

| CostBase MX Entity | Neodata Table Name (fill in) | Key Columns to Extract |
|--------------------|------------------------------|----------------------|
| `partidas` | `___________` | id, descripcion, padre_id, nivel, clave |
| `insumos` | `___________` | id, clave, descripcion, unidad, tipo |
| `conceptos` | `___________` | id, clave, descripcion, unidad, partida_id |
| `matrices` | `___________` | concepto_id, insumo_id, cantidad, orden |
| `precios` (seed) | `___________` | insumo_id, precio, region_id |
| `unidades` | `___________` | id, nombre, abreviatura |

### Step 3: Run the Full Extraction

```python
# extract.py — Full extraction pipeline
import sqlite3
import pandas as pd
import psycopg2
import uuid
import json
import os
from datetime import date
from rich.console import Console
from rich.progress import track
from dotenv import load_dotenv

load_dotenv()
console = Console()

NEODATA_PATH = os.getenv("NEODATA_DB_PATH")
PG_DSN = os.getenv("POSTGRES_DSN")

# ── IMPORTANT: Update these after running discover_schema.py ──────────────────
# Replace with actual Neodata table names discovered in Step 1
TABLE_MAP = {
    "partidas":   "Partidas",     # UPDATE THIS
    "insumos":    "Insumos",      # UPDATE THIS
    "conceptos":  "Conceptos",    # UPDATE THIS
    "matrices":   "Matrices",     # UPDATE THIS
    "precios":    "InsumoPrecios",# UPDATE THIS — may not exist in free version
    "unidades":   "Unidades",     # UPDATE THIS
}

# Column name mapping — UPDATE after schema discovery
COL_MAP = {
    "partidas": {
        "id":          "Id",
        "clave":       "Clave",
        "descripcion": "Descripcion",
        "padre_id":    "PadreId",   # NULL for root nodes
        "nivel":       "Nivel",
        "orden":       "Orden",
    },
    "insumos": {
        "id":          "Id",
        "clave":       "Clave",
        "descripcion": "Descripcion",
        "unidad":      "Unidad",
        "tipo":        "Tipo",       # M, J, E, %, SC, B
        "partida_id":  "PartidaId",
    },
    "conceptos": {
        "id":          "Id",
        "clave":       "Clave",
        "descripcion": "Descripcion",
        "unidad":      "Unidad",
        "partida_id":  "PartidaId",
        "tipo_maestro":"TipoMaestro", # constructor, desarrollador, etc.
    },
    "matrices": {
        "concepto_id": "ConceptoId",
        "insumo_id":   "InsumoId",
        "cantidad":    "Cantidad",
        "desperdicio": "Desperdicio",
        "nivel":       "Nivel",
        "orden":       "Orden",
    },
}

def extract_table(src_conn, table_name: str, columns: dict) -> pd.DataFrame:
    """Extract a table from Neodata using the column mapping."""
    col_select = ", ".join([f"{v} as {k}" for k, v in columns.items()])
    query = f"SELECT {col_select} FROM [{table_name}]"
    df = pd.read_sql(query, src_conn)
    console.log(f"  Extracted {table_name}: [bold]{len(df):,}[/bold] rows")
    return df

def normalize_tipo_insumo(tipo_raw: str) -> str:
    """Normalize Neodata insumo type codes to CostBase MX standard."""
    mapping = {
        "M": "material",
        "J": "mano_obra",
        "E": "maquinaria",
        "%": "herramienta",
        "SC": "subcontrato",
        "B": "basico_obra",
    }
    return mapping.get(str(tipo_raw).upper().strip(), "material")

def run_extraction():
    console.rule("[bold blue]CostBase MX — Phase 1 Extraction")

    # Connect to Neodata
    console.log(f"Connecting to Neodata at: {NEODATA_PATH}")
    src = sqlite3.connect(NEODATA_PATH)

    # Connect to PostgreSQL
    console.log("Connecting to PostgreSQL...")
    dst = psycopg2.connect(PG_DSN)
    dst.autocommit = False

    try:
        # ── Extract all entities ──────────────────────────────────────────────
        console.rule("Extracting from Neodata")
        
        partidas  = extract_table(src, TABLE_MAP["partidas"],  COL_MAP["partidas"])
        insumos   = extract_table(src, TABLE_MAP["insumos"],   COL_MAP["insumos"])
        conceptos = extract_table(src, TABLE_MAP["conceptos"], COL_MAP["conceptos"])
        matrices  = extract_table(src, TABLE_MAP["matrices"],  COL_MAP["matrices"])

        # Prices (may only be available in Nube+ version)
        try:
            precios_raw = pd.read_sql(
                f"SELECT InsumoId, RegionId, Precio FROM [{TABLE_MAP['precios']}]",
                src
            )
            console.log(f"  Extracted precios: [bold]{len(precios_raw):,}[/bold] rows")
        except Exception:
            console.log("  [yellow]Precios table not found — using insumo base price as Region 1 seed")
            # Fallback: extract base price from insumos table if it has a price column
            precios_raw = None

        # ── Normalize and transform ───────────────────────────────────────────
        console.rule("Transforming data")

        # Normalize insumo types
        insumos["tipo"] = insumos["tipo"].apply(normalize_tipo_insumo)

        # Generate UUID mapping (Neodata uses integer IDs)
        partida_uuid_map  = {int(i): str(uuid.uuid4()) for i in partidas["id"]}
        insumo_uuid_map   = {int(i): str(uuid.uuid4()) for i in insumos["id"]}
        concepto_uuid_map = {int(i): str(uuid.uuid4()) for i in conceptos["id"]}

        # ── Migrate to PostgreSQL ─────────────────────────────────────────────
        console.rule("Migrating to PostgreSQL")
        cur = dst.cursor()

        # 1. Partidas
        console.log("Inserting partidas...")
        for _, row in track(partidas.iterrows(), total=len(partidas), description="partidas"):
            new_id     = partida_uuid_map[int(row["id"])]
            padre_uuid = partida_uuid_map.get(int(row["padre_id"])) if pd.notna(row.get("padre_id")) else None
            nivel      = int(row["nivel"]) if pd.notna(row.get("nivel")) else 1
            orden      = int(row["orden"]) if pd.notna(row.get("orden")) else 0
            cur.execute("""
                INSERT INTO partidas (id, clave_neodata, nombre, padre_id, nivel, orden)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (new_id, str(row["clave"]), str(row["descripcion"]), padre_uuid, nivel, orden))

        # 2. Insumos
        console.log("Inserting insumos...")
        for _, row in track(insumos.iterrows(), total=len(insumos), description="insumos"):
            new_id     = insumo_uuid_map[int(row["id"])]
            partida_id = partida_uuid_map.get(int(row["partida_id"])) if pd.notna(row.get("partida_id")) else None
            cur.execute("""
                INSERT INTO insumos (id, clave_neodata, nombre, unidad, tipo, partida_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (new_id, str(row["clave"]), str(row["descripcion"]),
                  str(row["unidad"]), str(row["tipo"]), partida_id))

        # 3. Conceptos
        console.log("Inserting conceptos...")
        for _, row in track(conceptos.iterrows(), total=len(conceptos), description="conceptos"):
            new_id     = concepto_uuid_map[int(row["id"])]
            partida_id = partida_uuid_map.get(int(row["partida_id"])) if pd.notna(row.get("partida_id")) else None
            cur.execute("""
                INSERT INTO conceptos (id, clave_neodata, nombre, unidad, partida_id)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (new_id, str(row["clave"]), str(row["descripcion"]),
                  str(row["unidad"]), partida_id))

        # 4. Matrices
        console.log("Inserting matrices...")
        inserted = 0
        for _, row in track(matrices.iterrows(), total=len(matrices), description="matrices"):
            concepto_id = concepto_uuid_map.get(int(row["concepto_id"]))
            insumo_id   = insumo_uuid_map.get(int(row["insumo_id"]))
            if not concepto_id or not insumo_id:
                continue  # skip orphaned rows
            desperdicio = float(row["desperdicio"]) if pd.notna(row.get("desperdicio")) else 0.0
            nivel       = int(row["nivel"])  if pd.notna(row.get("nivel"))  else 1
            orden       = int(row["orden"])  if pd.notna(row.get("orden"))  else 0
            cur.execute("""
                INSERT INTO matrices (id, concepto_id, insumo_id, cantidad, desperdicio, nivel, orden)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
            """, (concepto_id, insumo_id, float(row["cantidad"]), desperdicio, nivel, orden))
            inserted += 1
        console.log(f"  Matrices inserted: [bold]{inserted:,}[/bold]")

        # 5. Seed prices (Region 1)
        console.log("Inserting seed prices (Region 1)...")
        if precios_raw is not None:
            for _, row in track(precios_raw.iterrows(), total=len(precios_raw), description="precios"):
                insumo_id = insumo_uuid_map.get(int(row["InsumoId"]))
                if not insumo_id:
                    continue
                cur.execute("""
                    INSERT INTO precios (id, insumo_id, region_id, precio, fuente_tipo, confianza, fecha)
                    VALUES (gen_random_uuid(), %s, %s, %s, 'neodata_seed', 0.60, %s)
                """, (insumo_id, int(row["RegionId"]), float(row["Precio"]), date.today()))

        dst.commit()
        console.log("[bold green]Migration complete!")

    except Exception as e:
        dst.rollback()
        console.log(f"[bold red]Error: {e}")
        raise
    finally:
        src.close()
        dst.close()

if __name__ == "__main__":
    run_extraction()
```

---

## 7. Target Database Schema (PostgreSQL)

Run this SQL **before** the extraction script. The schema must exist before migrating data.

```sql
-- Enable pgvector extension (required for semantic search)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Regions (static reference table) ─────────────────────────────────────────
CREATE TABLE regiones (
  id      SERIAL PRIMARY KEY,          -- 1-11, matches Neodata region IDs
  nombre  TEXT NOT NULL,
  estados TEXT                          -- comma-separated list of states
);

INSERT INTO regiones (id, nombre, estados) VALUES
  (1,  'Valle de México',  'CDMX, Estado de México, Hidalgo'),
  (2,  'Norte',            'Chihuahua, Sonora, Sinaloa, Durango'),
  (3,  'Noreste',          'Nuevo León, Coahuila, Tamaulipas'),
  (4,  'Noroeste',         'Baja California, Baja California Sur'),
  (5,  'Occidente',        'Jalisco, Colima, Nayarit, Aguascalientes'),
  (6,  'Bajío',            'Guanajuato, Querétaro, Michoacán, San Luis Potosí'),
  (7,  'Centro-Sur',       'Morelos, Guerrero, Puebla, Tlaxcala'),
  (8,  'Sur',              'Oaxaca, Chiapas'),
  (9,  'Sureste',          'Veracruz, Tabasco'),
  (10, 'Península',        'Yucatán, Campeche, Quintana Roo'),
  (11, 'Pacífico Centro',  'Michoacán Costa, Guerrero Norte');

-- ── Partidas (hierarchical work taxonomy) ────────────────────────────────────
CREATE TABLE partidas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata TEXT UNIQUE,            -- original Neodata key for compatibility
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  padre_id      UUID REFERENCES partidas(id),  -- NULL = root node
  nivel         INT NOT NULL DEFAULT 1,         -- 1=partida, 2=subpartida, 3=sub-sub
  path          TEXT,                           -- '/01/01.01' for fast tree queries
  orden         INT DEFAULT 0
);

CREATE INDEX idx_partidas_padre ON partidas(padre_id);
CREATE INDEX idx_partidas_path  ON partidas(path);

-- ── Insumos (input catalog) ───────────────────────────────────────────────────
CREATE TABLE insumos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata    TEXT UNIQUE,
  nombre           TEXT NOT NULL,
  descripcion      TEXT,                -- AI-rewritten original description
  unidad           TEXT NOT NULL,       -- KG, M2, M3, ML, PZA, JOR, HR, LT, %
  tipo             TEXT NOT NULL        -- material|mano_obra|maquinaria|herramienta|subcontrato|basico_obra
                   CHECK (tipo IN ('material','mano_obra','maquinaria','herramienta','subcontrato','basico_obra')),
  partida_id       UUID REFERENCES partidas(id),
  especificaciones JSONB,               -- variable technical attributes
  tags             TEXT[],              -- for faceted search
  embedding        vector(1536),        -- for semantic search (pgvector)
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insumos_tipo      ON insumos(tipo);
CREATE INDEX idx_insumos_partida   ON insumos(partida_id);
CREATE INDEX idx_insumos_embedding ON insumos USING hnsw (embedding vector_cosine_ops);

-- ── Price history (append-only, never delete) ─────────────────────────────────
CREATE TABLE precios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id   UUID NOT NULL REFERENCES insumos(id),
  region_id   INT  NOT NULL REFERENCES regiones(id),
  precio      DECIMAL(14, 4) NOT NULL,
  moneda      TEXT NOT NULL DEFAULT 'MXN',
  fuente_url  TEXT,
  fuente_tipo TEXT NOT NULL              -- scraping|api_oficial|cotizacion|manual|neodata_seed
               CHECK (fuente_tipo IN ('scraping','api_oficial','cotizacion','manual','neodata_seed')),
  confianza   DECIMAL(3, 2)             -- 0.00 to 1.00 confidence score
               CHECK (confianza >= 0 AND confianza <= 1),
  fecha       DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_precios_insumo_region ON precios(insumo_id, region_id);
CREATE INDEX idx_precios_fecha         ON precios(fecha DESC);

-- ── View: current price = most recent per insumo/region ──────────────────────
CREATE VIEW precios_actuales AS
  SELECT DISTINCT ON (insumo_id, region_id)
    insumo_id,
    region_id,
    precio,
    moneda,
    fuente_tipo,
    confianza,
    fecha
  FROM precios
  ORDER BY insumo_id, region_id, fecha DESC;

-- ── Conceptos (unit prices) ───────────────────────────────────────────────────
CREATE TABLE conceptos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata TEXT UNIQUE,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  unidad        TEXT NOT NULL,          -- M2, ML, PZA, M3, etc.
  partida_id    UUID REFERENCES partidas(id),
  tipo_maestro  TEXT[],                 -- ['constructor','desarrollador','concursos']
  embedding     vector(1536),
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conceptos_partida   ON conceptos(partida_id);
CREATE INDEX idx_conceptos_embedding ON conceptos USING hnsw (embedding vector_cosine_ops);

-- ── Matrices (unit price composition: concepto → insumos) ────────────────────
CREATE TABLE matrices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto_id UUID NOT NULL REFERENCES conceptos(id) ON DELETE CASCADE,
  insumo_id   UUID NOT NULL REFERENCES insumos(id),
  cantidad    DECIMAL(14, 6) NOT NULL,  -- yield per unit of the concepto
  desperdicio DECIMAL(5, 4) DEFAULT 0,  -- waste factor (0.05 = 5%)
  nivel       INT DEFAULT 1,            -- hierarchy level within the matrix
  orden       INT DEFAULT 0,            -- display order
  UNIQUE(concepto_id, insumo_id, nivel)
);

CREATE INDEX idx_matrices_concepto ON matrices(concepto_id);
CREATE INDEX idx_matrices_insumo   ON matrices(insumo_id);

-- ── Intelimats catalog (structure only — NOT implemented in Phase 1) ──────────
-- This table catalogs the 229 Intelimats from Neodata for reference.
-- The actual parametric engine is built in Phase 3.
CREATE TABLE intelimats_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata TEXT,
  nombre        TEXT NOT NULL,
  parametros    JSONB,                  -- {param_name: {type, min, max, default}}
  conceptos_rel TEXT[],                 -- which Neodata concept claves it relates to
  implementado  BOOLEAN DEFAULT false,  -- true = Phase 3 engine available
  notas         TEXT
);
```

---

## 8. Extraction Scripts

### 8.1 Schema Discovery Script

Run this first. Output tells you the real Neodata table names to use in `TABLE_MAP`.

```python
# scripts/01_discover_schema.py
import sqlite3
import sys

def discover(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in cur.fetchall()]
    print(f"\nFound {len(tables)} tables:\n")

    for t in tables:
        cur.execute(f"SELECT COUNT(*) FROM [{t}]")
        count = cur.fetchone()[0]
        cur.execute(f"PRAGMA table_info([{t}])")
        cols = [f"{r[1]}({r[2]})" for r in cur.fetchall()]
        print(f"  {t:40s} {count:>8,} rows  |  {', '.join(cols[:6])}{'...' if len(cols)>6 else ''}")

    conn.close()

if __name__ == "__main__":
    discover(sys.argv[1] if len(sys.argv) > 1 else "ConstruBase.db")
```

### 8.2 Main Extraction Script

See [Section 6, Step 3](#step-3-run-the-full-extraction) above for the full `extract.py` script.

### 8.3 Path Computation (partidas tree)

After inserting all partidas, compute the `path` column for fast hierarchical queries:

```python
# scripts/03_compute_paths.py
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def compute_paths():
    conn = psycopg2.connect(os.getenv("POSTGRES_DSN"))
    cur = conn.cursor()

    # Recursive CTE to build paths bottom-up
    cur.execute("""
        WITH RECURSIVE tree AS (
            -- Root nodes
            SELECT id, clave_neodata, padre_id,
                   '/' || COALESCE(clave_neodata, id::text) AS path
            FROM partidas
            WHERE padre_id IS NULL

            UNION ALL

            -- Children
            SELECT p.id, p.clave_neodata, p.padre_id,
                   t.path || '/' || COALESCE(p.clave_neodata, p.id::text)
            FROM partidas p
            JOIN tree t ON p.padre_id = t.id
        )
        UPDATE partidas
        SET path = tree.path
        FROM tree
        WHERE partidas.id = tree.id
    """)

    conn.commit()
    conn.close()
    print("Paths computed for all partidas.")

if __name__ == "__main__":
    compute_paths()
```

---

## 9. Embedding Generation

Run after the migration is complete. Embeddings enable natural-language search: a user typing "cement for foundation" will find "CEMENTO PORTLAND TIPO I" even without exact keyword matching.

```python
# scripts/04_generate_embeddings.py
import psycopg2
import openai
import json
import os
import time
from rich.progress import track
from dotenv import load_dotenv

load_dotenv()

client    = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
BATCH_SIZE = 100  # stay within rate limits
MODEL      = "text-embedding-3-small"

def build_insumo_text(row: dict) -> str:
    """
    Build a rich text for embedding.
    Combines name, type, unit, and any available description.
    Richer text = better semantic search quality.
    """
    parts = [row["nombre"]]
    if row.get("descripcion"):
        parts.append(row["descripcion"])
    parts.append(f"tipo: {row['tipo']}")
    parts.append(f"unidad: {row['unidad']}")
    if row.get("tags"):
        parts.append(f"tags: {', '.join(row['tags'])}")
    return " | ".join(parts)

def embed_batch(texts: list[str]) -> list[list[float]]:
    """Call OpenAI embeddings API with retry on rate limit."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(model=MODEL, input=texts)
            return [e.embedding for e in response.data]
        except openai.RateLimitError:
            wait = (attempt + 1) * 10
            print(f"Rate limited. Waiting {wait}s...")
            time.sleep(wait)
    raise RuntimeError("Failed after 3 retries")

def generate_embeddings():
    conn = psycopg2.connect(os.getenv("POSTGRES_DSN"))
    cur  = conn.cursor()

    # Estimate cost before running
    cur.execute("SELECT COUNT(*) FROM insumos WHERE embedding IS NULL")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM conceptos WHERE embedding IS NULL")
    total += cur.fetchone()[0]
    tokens_est  = total * 15  # ~15 tokens per text
    cost_est_usd = tokens_est / 1_000_000 * 0.02  # $0.02 per 1M tokens (ada-3-small)
    print(f"\nEstimated: {total:,} embeddings, ~{tokens_est:,} tokens, ~${cost_est_usd:.2f} USD")
    confirm = input("Proceed? [y/N]: ")
    if confirm.lower() != "y":
        print("Aborted.")
        return

    # ── Insumos ───────────────────────────────────────────────────────────────
    cur.execute("""
        SELECT id, nombre, descripcion, tipo, unidad, tags
        FROM insumos WHERE embedding IS NULL
    """)
    rows = cur.fetchall()
    cols = ["id", "nombre", "descripcion", "tipo", "unidad", "tags"]

    for i in track(range(0, len(rows), BATCH_SIZE), description="Embedding insumos"):
        batch = [dict(zip(cols, r)) for r in rows[i:i+BATCH_SIZE]]
        texts = [build_insumo_text(b) for b in batch]
        embeddings = embed_batch(texts)
        for row_dict, emb in zip(batch, embeddings):
            cur.execute(
                "UPDATE insumos SET embedding = %s WHERE id = %s",
                (json.dumps(emb), row_dict["id"])
            )
        conn.commit()

    # ── Conceptos ─────────────────────────────────────────────────────────────
    cur.execute("SELECT id, nombre, descripcion, unidad FROM conceptos WHERE embedding IS NULL")
    rows = cur.fetchall()
    cols = ["id", "nombre", "descripcion", "unidad"]

    for i in track(range(0, len(rows), BATCH_SIZE), description="Embedding conceptos"):
        batch  = [dict(zip(cols, r)) for r in rows[i:i+BATCH_SIZE]]
        texts  = [f"{b['nombre']} | {b.get('descripcion','')} | unidad: {b['unidad']}" for b in batch]
        embeddings = embed_batch(texts)
        for row_dict, emb in zip(batch, embeddings):
            cur.execute(
                "UPDATE conceptos SET embedding = %s WHERE id = %s",
                (json.dumps(emb), row_dict["id"])
            )
        conn.commit()

    conn.close()
    print("\nEmbedding generation complete.")

if __name__ == "__main__":
    generate_embeddings()
```

### 9.1 Verify Semantic Search Works

```python
# scripts/05_test_search.py
import psycopg2
import openai
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def search(query: str, limit: int = 5):
    # Generate embedding for the query
    resp = client.embeddings.create(model="text-embedding-3-small", input=[query])
    qvec = json.dumps(resp.data[0].embedding)

    conn = psycopg2.connect(os.getenv("POSTGRES_DSN"))
    cur  = conn.cursor()
    cur.execute("""
        SELECT nombre, tipo, unidad,
               1 - (embedding <=> %s::vector) AS similarity
        FROM insumos
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """, (qvec, qvec, limit))

    results = cur.fetchall()
    conn.close()

    print(f"\nQuery: '{query}'")
    print("-" * 60)
    for nombre, tipo, unidad, sim in results:
        print(f"  {sim:.3f}  [{tipo:12s}]  {nombre} ({unidad})")

if __name__ == "__main__":
    search("cement for foundation")
    search("mason labor per day")
    search("steel rebar 3/8 inch")
    search("waterproofing membrane for roof")
```

---

## 10. Data Validation

Run after migration and embedding generation. All checks must pass before Phase 1 is considered complete.

```python
# scripts/06_validate.py
import psycopg2
import os
import sys
from dataclasses import dataclass
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

load_dotenv()
console = Console()

@dataclass
class Check:
    name: str
    query: str
    expected_min: int | None = None
    expected_max: int | None = None
    expected_exact: int | None = None

CHECKS = [
    Check("Partidas (root nodes)",    "SELECT COUNT(*) FROM partidas WHERE padre_id IS NULL", expected_min=5),
    Check("Partidas (total)",         "SELECT COUNT(*) FROM partidas",                         expected_min=100),
    Check("Insumos (total)",          "SELECT COUNT(*) FROM insumos",                          expected_min=22000),
    Check("Insumos - material",       "SELECT COUNT(*) FROM insumos WHERE tipo='material'",    expected_min=10000),
    Check("Insumos - mano_obra",      "SELECT COUNT(*) FROM insumos WHERE tipo='mano_obra'",   expected_min=500),
    Check("Insumos - maquinaria",     "SELECT COUNT(*) FROM insumos WHERE tipo='maquinaria'",  expected_min=100),
    Check("Conceptos (total)",        "SELECT COUNT(*) FROM conceptos",                        expected_min=9000),
    Check("Matrices (total)",         "SELECT COUNT(*) FROM matrices",                         expected_min=50000),
    Check("Matrices - orphan conceptos", "SELECT COUNT(*) FROM matrices m LEFT JOIN conceptos c ON m.concepto_id=c.id WHERE c.id IS NULL", expected_exact=0),
    Check("Matrices - orphan insumos",   "SELECT COUNT(*) FROM matrices m LEFT JOIN insumos i ON m.insumo_id=i.id WHERE i.id IS NULL",    expected_exact=0),
    Check("Precios seed (Region 1)", "SELECT COUNT(*) FROM precios WHERE region_id=1",         expected_min=10000),
    Check("Insumos with embedding",  "SELECT COUNT(*) FROM insumos WHERE embedding IS NOT NULL", expected_min=22000),
    Check("Conceptos with embedding","SELECT COUNT(*) FROM conceptos WHERE embedding IS NOT NULL", expected_min=9000),
    Check("Partidas with path",      "SELECT COUNT(*) FROM partidas WHERE path IS NOT NULL",   expected_min=100),
]

def run_validation():
    conn = psycopg2.connect(os.getenv("POSTGRES_DSN"))
    cur  = conn.cursor()

    table = Table(title="Phase 1 Validation Report")
    table.add_column("Check", style="cyan", no_wrap=True)
    table.add_column("Result", justify="right")
    table.add_column("Expected", justify="right", style="dim")
    table.add_column("Status", justify="center")

    all_pass = True
    for check in CHECKS:
        cur.execute(check.query)
        result = cur.fetchone()[0]

        if check.expected_exact is not None:
            passed = result == check.expected_exact
            expected_str = f"= {check.expected_exact}"
        elif check.expected_min is not None and check.expected_max is not None:
            passed = check.expected_min <= result <= check.expected_max
            expected_str = f"{check.expected_min} – {check.expected_max}"
        elif check.expected_min is not None:
            passed = result >= check.expected_min
            expected_str = f">= {check.expected_min:,}"
        else:
            passed = True
            expected_str = "—"

        status = "[bold green]PASS[/]" if passed else "[bold red]FAIL[/]"
        if not passed:
            all_pass = False

        table.add_row(check.name, f"{result:,}", expected_str, status)

    conn.close()
    console.print(table)

    if all_pass:
        console.print("\n[bold green]All checks passed. Phase 1 complete.[/]")
        sys.exit(0)
    else:
        console.print("\n[bold red]Some checks failed. Review extraction logs.[/]")
        sys.exit(1)

if __name__ == "__main__":
    run_validation()
```

---

## 11. Acceptance Criteria

Phase 1 is complete when **all** of the following are true:

| # | Criterion | How to verify |
|---|-----------|--------------|
| AC-01 | PostgreSQL database is up with all tables and indexes | `\dt` in psql |
| AC-02 | `partidas` table has at least 100 records with correct tree structure (padre_id relationships) | Validation script check |
| AC-03 | `insumos` table has at least 22,000 records | Validation script check |
| AC-04 | `conceptos` table has at least 9,000 records | Validation script check |
| AC-05 | `matrices` table has at least 50,000 records | Validation script check |
| AC-06 | Zero orphaned foreign keys in matrices table | Validation script checks for 0 orphans |
| AC-07 | Seed prices for Region 1 inserted for at least 10,000 insumos | Validation script check |
| AC-08 | 100% of insumos and conceptos have embeddings | Validation script check |
| AC-09 | Semantic search returns relevant results for 5 test queries | Run `scripts/05_test_search.py` manually |
| AC-10 | All partidas have a computed `path` column value | Validation script check |
| AC-11 | Schema mapping document (D1) exists and is accurate | Code review |
| AC-12 | All scripts are in version control with `.env.example` | Git review |

---

## 12. Known Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Neodata uses encrypted or proprietary format | Low | High | Try DBeaver with multiple drivers (SQLite, ODBC, MSSQL CE). If encrypted, use Neodata's own XML export feature if available. |
| Table names differ significantly from expected | High | Medium | Run `discover_schema.py` first — always. Never hardcode table names without verification. |
| Neodata free version only has Region 1 prices | High | Low | Expected. Phase 2 handles all 11 regions via live market scraping. Use Region 1 as seed. |
| Record counts lower than expected | Medium | Medium | Neodata may segment its catalog differently. Accept ≥95% of targets; investigate outliers. |
| `padre_id` is stored as integer 0 (not NULL) for root nodes | Medium | Medium | Normalize: `WHERE padre_id = 0` → `SET padre_id = NULL` during migration. |
| OpenAI API rate limits during embedding generation | High | Low | Script already handles this with retry + backoff. Run overnight if needed. |
| Unicode/encoding issues in Spanish text | Medium | Low | Use `encoding='utf-8'` in all file reads; psycopg2 handles UTF-8 natively. |

---

## Appendix A: Script Execution Order

```
1.  python scripts/01_discover_schema.py ConstruBase.db    # Map real table names
2.  UPDATE extract.py TABLE_MAP and COL_MAP with real names
3.  psql -f schema.sql                                      # Create PostgreSQL schema
4.  python scripts/extract.py                               # Extract + migrate data
5.  python scripts/03_compute_paths.py                      # Compute partidas paths
6.  python scripts/04_generate_embeddings.py               # Generate embeddings
7.  python scripts/05_test_search.py                        # Verify semantic search
8.  python scripts/06_validate.py                           # Run all acceptance criteria
```

## Appendix B: Useful PostgreSQL Queries for Manual Verification

```sql
-- Count records by entity
SELECT 'partidas'  AS entity, COUNT(*) FROM partidas
UNION ALL SELECT 'insumos',   COUNT(*) FROM insumos
UNION ALL SELECT 'conceptos', COUNT(*) FROM conceptos
UNION ALL SELECT 'matrices',  COUNT(*) FROM matrices
UNION ALL SELECT 'precios',   COUNT(*) FROM precios;

-- Show root partidas (top level of the tree)
SELECT clave_neodata, nombre, nivel
FROM partidas WHERE padre_id IS NULL ORDER BY orden;

-- Show insumo type distribution
SELECT tipo, COUNT(*) FROM insumos GROUP BY tipo ORDER BY COUNT(*) DESC;

-- Show a full matrix for a specific concepto
SELECT c.nombre AS concepto, i.nombre AS insumo, m.cantidad, i.unidad
FROM matrices m
JOIN conceptos c ON m.concepto_id = c.id
JOIN insumos   i ON m.insumo_id   = i.id
WHERE c.nombre ILIKE '%losa%maciza%'
ORDER BY m.orden;

-- Semantic search (replace [1,0,...] with actual embedding vector)
SELECT nombre, tipo, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS score
FROM insumos ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector LIMIT 10;
```
