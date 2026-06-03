# CostBase MX — Labor Pricing Task
## Parse CONASAMI Salary Table & Update All 37 Cuadrillas

**Priority:** HIGH — unblocks 36% of matrix cost coverage  
**Estimated execution time:** 2–4 hours  
**Update cadence:** Annual — run every January 1st  
**Agent autonomy:** Full — execute all steps, report results at the end  
**Version:** 1.0 — June 2025  

---

## Table of Contents

1. [Objective](#1-objective)
2. [Background: How Labor Pricing Works in Neodata](#2-background-how-labor-pricing-works-in-neodata)
3. [Data Sources](#3-data-sources)
4. [The 37 Cuadrillas to Price](#4-the-37-cuadrillas-to-price)
5. [CONASAMI Trade → Cuadrilla Mapping](#5-conasami-trade--cuadrilla-mapping)
6. [Step-by-Step Execution Plan](#6-step-by-step-execution-plan)
7. [Salary Calculation Formula](#7-salary-calculation-formula)
8. [Region Mapping](#8-region-mapping)
9. [SQL Statements](#9-sql-statements)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Edge Cases & Fallbacks](#11-edge-cases--fallbacks)
12. [Output Report Format](#12-output-report-format)

---

## 1. Objective

Update the `precios` table in the CostBase MX PostgreSQL database with official 2025 labor prices for all 37 cuadrilla insumos extracted from the Neodata ConstruBase catalog.

Labor (mano de obra) represents approximately 30–40% of direct construction cost in Mexican projects. The current seed prices in the database come from Neodata's editorial estimates. This task replaces them with **official government salary data** from CONASAMI, giving a confidence score of 0.95 versus the 0.60 of the Neodata seed.

At the end of this task, all 37 cuadrillas must have updated prices for **all 11 regions** of Mexico.

---

## 2. Background: How Labor Pricing Works in Neodata

### 2.1 What is a Cuadrilla?

A cuadrilla is a work crew combining specific trades for a unit price analysis. Each cuadrilla has a cost per **JOR** (jornada = work day).

Example:
```
CUADRILLA No 5 (1 ALBAÑIL + 1 PEON)
  = daily wage of 1 mason + daily wage of 1 laborer
  × prestaciones factor
  = cost per JOR
```

### 2.2 The Prestaciones Factor

Mexican labor law requires employers to pay benefits on top of the base wage. The **factor de prestaciones integradas** converts the base daily wage into the total employer cost per day:

```
total_daily_cost = base_daily_wage × factor_prestaciones

Factor breakdown (approximate):
  Base wage:                    1.000
  IMSS employer contribution:  +0.210  (varies by wage bracket)
  INFONAVIT:                   +0.050
  SAR:                         +0.020
  Aguinaldo (15 days/year):    +0.041
  Prima vacacional:             +0.006
  Vacation days (6/year):      +0.016
  ─────────────────────────────────
  TOTAL FACTOR:                 1.343  → use 1.35 as standard

```

> **Use factor = 1.35** throughout this task. This is the standard Neodata uses and matches market practice for construction labor in Mexico.

### 2.3 Current Seed Prices (Reference Only)

The current Neodata seed prices give us a sanity check baseline:

| Cuadrilla pattern | Seed price (Region 1) | Workers |
|---|---|---|
| 1 worker cuadrilla | ~$893–$1,412 | 1 |
| 2 worker cuadrilla | ~$2,062–$2,262 | 2 |
| 3 worker cuadrilla | ~$2,917–$3,058 | 3 |
| 6 worker cuadrilla | ~$5,662 | 6 |

After applying the CONASAMI 2025 wages, expect results within **±15%** of these seed values. If a result deviates more than 20% from the seed, flag it for manual review.

---

## 3. Data Sources

### 3.1 Primary Source — CONASAMI

**Organization:** Comisión Nacional de los Salarios Mínimos  
**Website:** https://www.conasami.gob.mx  
**Table needed:** *Salarios Mínimos Profesionales y Especiales* — 2025 edition  

**Access strategy (in order of preference):**

1. **Direct PDF URL** (check if accessible):
   ```
   https://www.conasami.gob.mx/pdf/tabla_salarios_minimos/2025/SMG_y_Profesionales_01012025.pdf
   ```

2. **Web search** if direct URL fails:
   ```
   Search: "salarios mínimos profesionales 2025 CONASAMI tabla construcción"
   Look for: Official PDF with DOF (Diario Oficial de la Federación) publication
   ```

3. **DOF direct search**:
   ```
   https://www.dof.gob.mx
   Search: "salarios mínimos 2025" in decrees section
   ```

### 3.2 What to Extract from the PDF

The CONASAMI PDF has two tables:
- **Table 1:** Salario Mínimo General (one value for Zone General, one for ZLFN)
- **Table 2:** Salarios Mínimos Profesionales — this is what you need

From Table 2, extract **all construction-related trades**. They appear under categories like:
- Trabajadores de la Construcción
- Electricidad
- Plomería

The format is: `Trade name | Daily wage Zone General | Daily wage ZLFN`

**Target trades to extract** (minimum required):

```
Albañil
Ayudante de albañil (peón)
Ayudante general
Ayudante especializado
Carpintero en obra negra
Carpintero en obra blanca (acabados)
Electricista instalador y reparador en general
Fierrero en construcción
Herrero
Oficial de instalaciones
Pintor de obras
Plomero y gasero
Soldador con soplete y/o arco eléctrico
Azulejero y colocador de pisos
Vidriero
Yesero
Barnizador
Cabo de cuadrilla
Sobrestante
Tubero en instalaciones hidráulicas y sanitarias
Topógrafo
Maniobrista en construcción
Operador de maquinaria pesada en construcción
Técnico en instalaciones especiales
Técnico certificado (sistemas, aire acondicionado, etc.)
Aluminiero (instalador de sistemas de aluminio arquitectónico)
```

### 3.3 2025 Minimum Wages (Reference Values for Validation)

Use these to validate your extraction is correct:

```
Salario Mínimo General 2025:    $278.80 MXN/day (Zone General)
Salario Mínimo ZLFN 2025:       $419.08 MXN/day (Northern Border Zone)
```

> If the wages you extract are far below these values, the extraction failed — professional wages are ALWAYS above the general minimum.

---

## 4. The 37 Cuadrillas to Price

These are all cuadrilla insumos in the top 600 frequency list, extracted from the Neodata ConstruBase database. **All 37 must have prices inserted for all 11 regions.**

| # | Neodata Key | Name | Matrices | Seed Price R1 | Workers |
|---|------------|------|----------|---------------|---------|
| 1 | `1P1E` | CUADRILLA No 20 (1 PLOMERO + 1 AY.ESP.) | 4,252 | $2,158.47 | 2 |
| 2 | `1E1E` | CUADRILLA No 19 (1 ELECTRIC. + AY.ESP) | 2,230 | $2,158.47 | 2 |
| 3 | `1I1E` | CUADRILLA No 24 (1 OF. INST. + 1 AY.ESP.) | 1,478 | $2,158.47 | 2 |
| 4 | `1T1E` | CUADRILLA No 21 (1 TECNICO + 1 AY.ESP.) | 1,426 | $2,138.71 | 2 |
| 5 | `1CO1A` | CUADRILLA No 12 (1 COLOCADOR + 1 AY.) | 926 | $2,106.41 | 2 |
| 6 | `1A` | CUADRILLA No 3 (1 AYUDANTE GENERAL) | 750 | $910.49 | 1 |
| 7 | `1A1P` | CUADRILLA No 5 (1 ALBAÑIL + 1 PEON) | 581 | $2,089.07 | 2 |
| 8 | `1A1A` | CUADRILLA No 11 (1 AZULEJERO + AYUD.) | 504 | $2,080.37 | 2 |
| 9 | `1S2E` | CUADRILLA No 18 (1 SOLDADOR + 2 AY.ESP.) | 364 | $3,057.89 | 3 |
| 10 | `1H1A` | CUADRILLA No 9 (1 HERRERO + AYUDANTE) | 350 | $2,132.44 | 2 |
| 11 | `1F1A` | CUADRILLA No 6 (1 FIERRERO + 1 AYUDANTE) | 264 | $2,115.10 | 2 |
| 12 | `1T1A-U` | CUADRILLA No 86 (1 TUBERO + 1 AY.) URBANIZACION | 236 | $2,151.53 | 2 |
| 13 | `1A5P` | CUADRILLA No 22 (1 ALBAÑIL + 5 PEONES) | 225 | $5,661.69 | 6 |
| 14 | `1P` | CUADRILLA No 1 (1 PEON) | 212 | $893.15 | 1 |
| 15 | `1T2A-U` | CUADRILLA No 87 (1 TUBERO + 2 AY.) URBANIZACION | 200 | $2,946.76 | 3 |
| 16 | `1C1A` | CUADRILLA No 7 (1 CARP. O.N. + AYUDANTE) | 199 | $2,132.44 | 2 |
| 17 | `1V1A` | CUADRILLA No 14 (1 VIDRIERO + AYUDANTE) | 196 | $2,097.73 | 2 |
| 18 | `1A1E` | CUADRILLA No 16 (1 ALUMINIERO + AY.ESP.) | 185 | $2,149.79 | 2 |
| 19 | `1P1A` | CUADRILLA No 8 (1 PINTOR + AYUDANTE) | 177 | $2,062.99 | 2 |
| 20 | `2A` | CUADRILLA No 4 (2 AYUDANTE GENERAL) | 143 | $1,820.99 | 2 |
| 21 | `1M2E` | CUADRILLA 34 (1 MANIOBRISTA + 2 AY.ESP.) | 134 | $2,953.70 | 3 |
| 22 | `1C1E` | CUADRILLA No 15 (1 CARP. O.B. + AY.ESP.) | 102 | $2,149.79 | 2 |
| 23 | `1TC1E` | CUADRILLA No 50 (1 TECNICO CERTIFICADO + 1 AY ESP) | 75 | $2,208.15 | 2 |
| 24 | `1S1E` | CUADRILLA No 17 (1 SOLDADOR + 1 AY.ESP.) | 67 | $2,262.66 | 2 |
| 25 | `1B1A` | CUADRILLA No 13 (1 BARNIZADOR + AYUD.) | 60 | $2,106.41 | 2 |
| 26 | `1P-U` | CUADRILLA No 71 (1 PEON) URBANIZACION | 55 | $893.15 | 1 |
| 27 | `1T1A` | CUADRILLA No 26 (1 TUBERO + 1 AY.) | 46 | $2,141.12 | 2 |
| 28 | `1OM` | CUADRILLA No 25 (1 OPERADOR DE MAQ.M.) | 25 | $1,068.08 | 1 |
| 29 | `1A1P-U` | CUADRILLA No 74 (1 ALBAÑIL + 1 PEON) URBANIZACION | 18 | $2,089.07 | 2 |
| 30 | `MO082` | CABO DE OFICIOS | 18 | $1,326.14 | 1 |
| 31 | `MO031` | AYUDANTE ESPECIALIZADO | 14 | $795.23 | 1 |
| 32 | `2T2A-U` | CUADRILLA No 88 (2 TUBEROS + 2 AY.) URBANIZACION | 13 | $4,268.36 | 4 |
| 33 | `MO021` | AYUDANTE GENERAL | 12 | $777.88 | 1 |
| 34 | `1A-U` | CUADRILLA No 72 (1 AYUDANTE) URBANIZACION | 11 | $910.49 | 1 |
| 35 | `1Y1A` | CUADRILLA No 10 (1 YESERO + AYUDANTE) | 10 | $2,080.37 | 2 |
| 36 | `1T2E` | CUADRILLA No 32 (1 TOPOGRAFO + 2 AY.ESP.) | 10 | $2,916.60 | 3 |
| 37 | `MO094` | SOBRESTANTE | 8 | $1,412.92 | 1 |

---

## 5. CONASAMI Trade → Cuadrilla Mapping

Use this mapping to compose each cuadrilla's daily cost from individual CONASAMI wages. The mapping uses **CONASAMI trade codes** (extract these during PDF parsing).

### 5.1 Individual Trade Wages Needed

Extract these specific CONASAMI professional categories:

```
TRADE_CODE       CONASAMI CATEGORY NAME (as appears in PDF)
─────────────────────────────────────────────────────────────
ALBANIL          Albañil
PEON             Ayudante de albañil / Peón de construcción
AY_GENERAL       Ayudante general
AY_ESP           Ayudante especializado
CARPINTERO_ON    Carpintero en obra negra
CARPINTERO_OB    Carpintero en acabados (obra blanca)
ELECTRICISTA     Electricista instalador y reparador en general
FIERRERO         Fierrero (habilitador de acero)
HERRERO          Herrero
OF_INSTALACIONES Oficial instalador (plomería/gas/sanitaria)
PINTOR           Pintor de obras
PLOMERO          Plomero y gasero
SOLDADOR         Soldador con soplete y/o arco eléctrico
AZULEJERO        Azulejero y colocador de pisos
VIDRIERO         Vidriero
YESERO           Yesero
BARNIZADOR       Barnizador
ALUMINIERO       Instalador de sistemas de aluminio arquitectónico
TUBERO           Tubero en instalaciones hidráulicas/sanitarias
TOPOGRAFO        Topógrafo en construcción
MANIOBRISTA      Maniobrista en construcción
OP_MAQ           Operador de maquinaria pesada en construcción
TECNICO          Técnico instalador (sistemas especiales)
TECNICO_CERT     Técnico certificado (sistemas complejos)
CABO             Cabo de cuadrilla / Cabo de oficios
SOBRESTANTE      Sobrestante
COLOCADOR        Colocador de revestimientos y acabados
```

> **If a trade is not found in the PDF:** Use `AY_ESP` (ayudante especializado) as the fallback. Log which trades required fallback.

### 5.2 Cuadrilla Composition Table

```
KEY       COMPOSITION                                    FORMULA
─────────────────────────────────────────────────────────────────────
1P1E      1×PLOMERO + 1×AY_ESP                          (PLOMERO + AY_ESP) × 1.35
1E1E      1×ELECTRICISTA + 1×AY_ESP                     (ELECTRICISTA + AY_ESP) × 1.35
1I1E      1×OF_INSTALACIONES + 1×AY_ESP                 (OF_INSTALACIONES + AY_ESP) × 1.35
1T1E      1×TECNICO + 1×AY_ESP                          (TECNICO + AY_ESP) × 1.35
1CO1A     1×COLOCADOR + 1×AY_GENERAL                    (COLOCADOR + AY_GENERAL) × 1.35
1A        1×AY_GENERAL                                   AY_GENERAL × 1.35
1A1P      1×ALBANIL + 1×PEON                            (ALBANIL + PEON) × 1.35
1A1A      1×AZULEJERO + 1×AY_GENERAL                    (AZULEJERO + AY_GENERAL) × 1.35
1S2E      1×SOLDADOR + 2×AY_ESP                         (SOLDADOR + 2×AY_ESP) × 1.35
1H1A      1×HERRERO + 1×AY_GENERAL                      (HERRERO + AY_GENERAL) × 1.35
1F1A      1×FIERRERO + 1×AY_GENERAL                     (FIERRERO + AY_GENERAL) × 1.35
1T1A-U    1×TUBERO + 1×AY_GENERAL                       (TUBERO + AY_GENERAL) × 1.35
1A5P      1×ALBANIL + 5×PEON                            (ALBANIL + 5×PEON) × 1.35
1P        1×PEON                                         PEON × 1.35
1T2A-U    1×TUBERO + 2×AY_GENERAL                       (TUBERO + 2×AY_GENERAL) × 1.35
1C1A      1×CARPINTERO_ON + 1×AY_GENERAL                (CARPINTERO_ON + AY_GENERAL) × 1.35
1V1A      1×VIDRIERO + 1×AY_GENERAL                     (VIDRIERO + AY_GENERAL) × 1.35
1A1E      1×ALUMINIERO + 1×AY_ESP                       (ALUMINIERO + AY_ESP) × 1.35
1P1A      1×PINTOR + 1×AY_GENERAL                       (PINTOR + AY_GENERAL) × 1.35
2A        2×AY_GENERAL                                   2×AY_GENERAL × 1.35
1M2E      1×MANIOBRISTA + 2×AY_ESP                      (MANIOBRISTA + 2×AY_ESP) × 1.35
1C1E      1×CARPINTERO_OB + 1×AY_ESP                    (CARPINTERO_OB + AY_ESP) × 1.35
1TC1E     1×TECNICO_CERT + 1×AY_ESP                     (TECNICO_CERT + AY_ESP) × 1.35
1S1E      1×SOLDADOR + 1×AY_ESP                         (SOLDADOR + AY_ESP) × 1.35
1B1A      1×BARNIZADOR + 1×AY_GENERAL                   (BARNIZADOR + AY_GENERAL) × 1.35
1P-U      1×PEON                                         PEON × 1.35  [same as 1P]
1T1A      1×TUBERO + 1×AY_GENERAL                       (TUBERO + AY_GENERAL) × 1.35  [same as 1T1A-U]
1OM       1×OP_MAQ                                       OP_MAQ × 1.35
1A1P-U    1×ALBANIL + 1×PEON                            (ALBANIL + PEON) × 1.35  [same as 1A1P]
MO082     1×CABO                                         CABO × 1.35
MO031     1×AY_ESP                                       AY_ESP × 1.35
2T2A-U    2×TUBERO + 2×AY_GENERAL                       (2×TUBERO + 2×AY_GENERAL) × 1.35
MO021     1×AY_GENERAL                                   AY_GENERAL × 1.35  [same as 1A]
1A-U      1×AY_GENERAL                                   AY_GENERAL × 1.35  [same as 1A]
1Y1A      1×YESERO + 1×AY_GENERAL                       (YESERO + AY_GENERAL) × 1.35
1T2E      1×TOPOGRAFO + 2×AY_ESP                        (TOPOGRAFO + 2×AY_ESP) × 1.35
MO094     1×SOBRESTANTE                                   SOBRESTANTE × 1.35
```

---

## 6. Step-by-Step Execution Plan

### Step 1 — Fetch the CONASAMI PDF

```python
# Try direct URL first
import httpx, fitz  # PyMuPDF for PDF parsing

CONASAMI_URL = "https://www.conasami.gob.mx/pdf/tabla_salarios_minimos/2025/SMG_y_Profesionales_01012025.pdf"

# If that fails, search for current URL:
# Search query: "salarios mínimos profesionales 2025 CONASAMI PDF"
# Look for the DOF publication from December 2024 / January 2025
```

### Step 2 — Parse Professional Salary Table

Extract trade names and daily wages from the PDF. The table format is typically:

```
OCUPACIÓN                                    ZONA GENERAL    ZONA FRONTERA NORTE
Albañil                                         XXX.XX            XXX.XX
Ayudante de albañil                             XXX.XX            XXX.XX
...
```

Parse into a Python dict:
```python
wages = {
    'ALBANIL':        {'zona_general': 450.50, 'zona_frontera': 650.00},
    'PEON':           {'zona_general': 320.00, 'zona_frontera': 480.00},
    # ... all trades
}
```

### Step 3 — Validate Extraction

Before proceeding, run these validation checks:
```python
assert wages['ALBANIL']['zona_general'] > 278.80,  "Albañil must exceed minimum wage"
assert wages['ALBANIL']['zona_frontera'] > 419.08, "Border wage must exceed ZLFN minimum"
assert len(wages) >= 20, "Must find at least 20 construction trades"

# Spot check: albañil should be ≈ 1.3–1.6× the general minimum
ratio = wages['ALBANIL']['zona_general'] / 278.80
assert 1.2 < ratio < 2.5, f"Albañil ratio {ratio:.2f} seems wrong"
```

If any assertion fails: stop execution, report the failure, do not insert any data.

### Step 4 — Build Trade Wage Lookup

```python
def get_daily_wage(trade_code: str, zona: str) -> float:
    """Get daily wage for a trade in a given zone."""
    if trade_code not in wages:
        # Fallback chain
        fallbacks = {
            'COLOCADOR':   'AZULEJERO',
            'ALUMINIERO':  'ALBANIL',
            'OF_INSTALACIONES': 'PLOMERO',
            'MANIOBRISTA': 'AY_ESP',
            'TECNICO':     'ELECTRICISTA',
            'TECNICO_CERT':'ELECTRICISTA',
        }
        fallback = fallbacks.get(trade_code, 'AY_ESP')
        print(f"WARNING: {trade_code} not found, using {fallback} as fallback")
        trade_code = fallback
    return wages[trade_code][zona]
```

### Step 5 — Calculate Price for Each Cuadrilla × Zone

```python
FACTOR_PRESTACIONES = 1.35

compositions = {
    '1P1E':   [('PLOMERO', 1), ('AY_ESP', 1)],
    '1E1E':   [('ELECTRICISTA', 1), ('AY_ESP', 1)],
    '1I1E':   [('OF_INSTALACIONES', 1), ('AY_ESP', 1)],
    # ... full mapping from Section 5.2
}

def calculate_cuadrilla_price(key: str, zona: str) -> float:
    composition = compositions[key]
    base_sum = sum(qty * get_daily_wage(trade, zona) for trade, qty in composition)
    return round(base_sum * FACTOR_PRESTACIONES, 2)

# Example:
# CUADRILLA No 5 (1 ALBAÑIL + 1 PEON), Region 1 (zona_general)
# = (450.50 + 320.00) × 1.35 = $1,040.18 / JOR
```

### Step 6 — Map Zones to Neodata Regions

```python
REGION_ZONE_MAP = {
    1:  'zona_general',   # Valle de México (CDMX)
    2:  'zona_general',   # Norte (interior cities dominate)
    3:  'zona_general',   # Noreste (use general; border premium is municipality-level)
    4:  'zona_frontera',  # Noroeste — Baja California is mostly ZLFN
    5:  'zona_general',   # Occidente
    6:  'zona_general',   # Bajío
    7:  'zona_general',   # Centro-Sur
    8:  'zona_general',   # Sur
    9:  'zona_general',   # Sureste
    10: 'zona_general',   # Península
    11: 'zona_general',   # Pacífico Centro
}
# Region 4 uses zona_frontera because Baja California is entirely within ZLFN
# Regions 2 and 3 have border municipalities but majority is interior → zona_general
```

### Step 7 — Validate Against Neodata Seed

Before inserting, compare each calculated price against the Neodata seed:

```python
seed_prices = {
    '1P1E':  2158.47,
    '1E1E':  2158.47,
    # ... from the table in Section 4
}

def validate_price(key: str, calculated: float, region: int) -> bool:
    if key not in seed_prices:
        return True  # No seed to compare against
    seed = seed_prices[key]
    delta_pct = abs(calculated - seed) / seed * 100
    if delta_pct > 25:
        print(f"WARNING: {key} R{region} calculated={calculated:.2f} vs seed={seed:.2f} delta={delta_pct:.1f}%")
        return False  # Flag for review but still insert
    return True
```

> **Important:** A delta > 25% is a WARNING, not a blocker. The seed may be outdated. Insert the calculated price but log the discrepancy in the output report.

### Step 8 — Fetch Insumo UUIDs from Database

```python
import psycopg2, os

conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
cur  = conn.cursor()

# Get all insumo UUIDs for our 37 cuadrillas
claves = list(compositions.keys()) + ['MO082','MO031','MO021','MO094','1P-U','1A1P-U','1A-U','2T2A-U','1T2E']
cur.execute("""
    SELECT clave_neodata, id 
    FROM insumos 
    WHERE clave_neodata = ANY(%s) AND tipo = 'mano_obra'
""", (claves,))
uuid_map = {row[0]: row[1] for row in cur.fetchall()}

print(f"Found {len(uuid_map)} / {len(claves)} cuadrillas in DB")
missing = [k for k in claves if k not in uuid_map]
if missing:
    print(f"NOT FOUND in DB: {missing}")
    # This is a problem — stop and report if > 5 missing
    if len(missing) > 5:
        raise RuntimeError(f"Too many cuadrillas not found in DB: {missing}")
```

### Step 9 — Insert Prices into precios Table

```python
from datetime import date

inserts = []

for key, insumo_uuid in uuid_map.items():
    for region_id in range(1, 12):
        zona = REGION_ZONE_MAP[region_id]
        price = calculate_cuadrilla_price(key, zona)
        
        inserts.append((
            insumo_uuid,       # insumo_id
            region_id,         # region_id
            price,             # precio
            'MXN',             # moneda
            'https://www.conasami.gob.mx',  # fuente_url
            'api_oficial',     # fuente_tipo
            0.95,              # confianza — official government data
            date(2025, 1, 1),  # fecha — effective date of CONASAMI table
        ))

# Bulk insert
cur.executemany("""
    INSERT INTO precios 
        (id, insumo_id, region_id, precio, moneda, fuente_url, fuente_tipo, confianza, fecha)
    VALUES 
        (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
""", inserts)

conn.commit()
print(f"Inserted {len(inserts)} price records ({len(uuid_map)} cuadrillas × 11 regions)")
```

---

## 7. Salary Calculation Formula

Full reference formula for each price record:

```
price_per_JOR = (Σ daily_wage[trade_i] × qty_i) × factor_prestaciones

Where:
  daily_wage[trade_i]  = from CONASAMI 2025 professional salary table
  qty_i                = number of workers of that trade in the cuadrilla
  factor_prestaciones  = 1.35 (constant — see Section 2.2)
  price_per_JOR        = total employer cost per work day for the cuadrilla
  
Units: MXN per JOR (jornada = 1 work day = 8 hours)
```

---

## 8. Region Mapping

| Region | Name | Key States | Zone | Notes |
|--------|------|-----------|------|-------|
| 1 | Valle de México | CDMX, EdoMex, Hidalgo | zona_general | Base reference |
| 2 | Norte | Chihuahua, Sonora, Sinaloa | zona_general | Mix; border cities are ZLFN but use general as conservative |
| 3 | Noreste | Nuevo León, Coahuila, Tamps | zona_general | Same rationale as Region 2 |
| 4 | Noroeste | Baja California | **zona_frontera** | Entire state is within ZLFN |
| 5 | Occidente | Jalisco, Nayarit, Colima | zona_general | |
| 6 | Bajío | Guanajuato, Querétaro | zona_general | |
| 7 | Centro-Sur | Morelos, Puebla, Guerrero | zona_general | |
| 8 | Sur | Oaxaca, Chiapas | zona_general | |
| 9 | Sureste | Veracruz, Tabasco | zona_general | |
| 10 | Península | Yucatán, Campeche, QRoo | zona_general | |
| 11 | Pacífico Centro | Michoacán Costa | zona_general | |

> **Result:** 10 regions use zona_general, 1 region (4) uses zona_frontera. This is a simplification — in practice border municipalities of Sonora, Chihuahua, Coahuila, and Tamaulipas also qualify for ZLFN. For v1.0 this simplification is acceptable.

---

## 9. SQL Statements

### 9.1 Schema Verification (run before inserting)

```sql
-- Verify the precios table exists and has the right structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'precios' 
ORDER BY ordinal_position;

-- Expected columns: id, insumo_id, region_id, precio, moneda, 
--                   fuente_url, fuente_tipo, confianza, fecha, created_at

-- Count existing MO seed prices
SELECT COUNT(*) as existing_mo_prices 
FROM precios p
JOIN insumos i ON p.insumo_id = i.id
WHERE i.tipo = 'mano_obra';
```

### 9.2 Post-Insert Verification

```sql
-- Verify all 37 cuadrillas have 11 regional prices
SELECT 
    i.clave_neodata,
    i.nombre,
    COUNT(p.id) AS n_regiones,
    MIN(p.precio) AS precio_min,
    MAX(p.precio) AS precio_max,
    AVG(p.precio)::numeric(10,2) AS precio_avg,
    MAX(p.fecha) AS fecha_actualizacion
FROM insumos i
JOIN precios p ON p.insumo_id = i.id
WHERE i.tipo = 'mano_obra'
  AND p.fuente_tipo = 'api_oficial'
GROUP BY i.id, i.clave_neodata, i.nombre
ORDER BY COUNT(p.id) DESC, i.nombre;
-- Expected: every row shows n_regiones = 11

-- Compare new prices vs old seed
SELECT 
    i.clave_neodata,
    i.nombre,
    p_old.precio AS seed_r1,
    p_new.precio AS conasami_r1,
    ROUND((p_new.precio - p_old.precio) / p_old.precio * 100, 1) AS delta_pct
FROM insumos i
JOIN precios p_old ON p_old.insumo_id = i.id 
    AND p_old.region_id = 1 
    AND p_old.fuente_tipo = 'neodata_seed'
JOIN precios p_new ON p_new.insumo_id = i.id 
    AND p_new.region_id = 1 
    AND p_new.fuente_tipo = 'api_oficial'
WHERE i.tipo = 'mano_obra'
ORDER BY ABS((p_new.precio - p_old.precio) / p_old.precio) DESC;
-- Expected: most deltas between -10% and +25%
-- Flag any delta > 30% for manual review
```

### 9.3 Rollback (if needed)

```sql
-- Only run this if something went wrong and you need to remove the new prices
DELETE FROM precios 
WHERE fuente_tipo = 'api_oficial' 
  AND fecha = '2025-01-01'
  AND insumo_id IN (
    SELECT id FROM insumos WHERE tipo = 'mano_obra'
  );
```

---

## 10. Acceptance Criteria

All of the following must be TRUE before the task is considered complete:

| # | Criterion | How to verify |
|---|-----------|--------------|
| AC-01 | CONASAMI PDF successfully fetched and parsed | Log shows "Found N construction trades" where N ≥ 20 |
| AC-02 | All extracted wages above general minimum ($278.80/day) | Validation assertions pass |
| AC-03 | All 37 cuadrillas found in the DB by clave_neodata | `len(uuid_map) == 37` (or report which are missing) |
| AC-04 | 407 price records inserted (37 cuadrillas × 11 regions) | `INSERT` count = 407 |
| AC-05 | All cuadrillas show n_regiones = 11 in post-insert verification SQL | Run Section 9.2 query |
| AC-06 | Region 4 prices are higher than Region 1 prices | `precio_R4 > precio_R1` for all cuadrillas (ZLFN premium) |
| AC-07 | No delta > 50% vs Neodata seed | Delta comparison query shows max abs delta < 50% |
| AC-08 | fuente_tipo = 'api_oficial' and confianza = 0.95 for all inserted records | Check in precios table |
| AC-09 | Original seed prices preserved (not deleted or overwritten) | `SELECT COUNT(*) FROM precios WHERE fuente_tipo = 'neodata_seed'` unchanged |
| AC-10 | Output report delivered with all required sections | See Section 12 |

---

## 11. Edge Cases & Fallbacks

### 11.1 Trade Not Found in PDF

Some Neodata trade categories do not have exact matches in CONASAMI. Use this fallback chain:

```
COLOCADOR          → use AZULEJERO
ALUMINIERO         → use ALBANIL (similar skill level in CONASAMI)
OF_INSTALACIONES   → use PLOMERO
MANIOBRISTA        → use AY_ESP
TECNICO            → use ELECTRICISTA
TECNICO_CERT       → use ELECTRICISTA × 1.10 (10% premium for certification)
CABO               → use ALBANIL (foreman level, similar wage in CONASAMI)
SOBRESTANTE        → use ALBANIL × 1.20 (supervisor premium)
COLOCADOR          → use AZULEJERO
```

Log every fallback used. Include count in output report.

### 11.2 PDF Not Accessible

If CONASAMI's website is down or the PDF URL has changed:

1. Try searching for the DOF (Diario Oficial de la Federación) publication
2. Search: `"salarios mínimos 2025" site:dof.gob.mx`
3. If both fail: use CONASAMI's web page https://www.conasami.gob.mx directly — they usually have a visible table on the homepage
4. If all three fail: abort and report `BLOCKED: CONASAMI source unavailable`

### 11.3 Cuadrilla Not Found in DB

If a clave_neodata from our list is not found in the `insumos` table:
- Log it as `NOT_IN_DB: {clave}`
- Continue with the rest
- If more than 10 cuadrillas are missing, abort with error

### 11.4 Delta > 50% vs Seed

If a calculated price deviates > 50% from the Neodata seed:
- **Still insert it** — CONASAMI is authoritative
- Log it as `HIGH_DELTA: {key} calculated={X} seed={Y} delta={Z}%`
- Include in output report's anomaly section
- Do not block the overall task

---

## 12. Output Report Format

At the end of execution, generate a structured report in this exact format:

```markdown
# IMSS/CONASAMI Labor Pricing — Execution Report
Date: {execution_date}
CONASAMI table version: {year} (effective {effective_date})

## Summary
- Cuadrillas priced: {n} / 37
- Regions covered: 11
- Total price records inserted: {n × 11}
- Fallbacks used: {n}
- High-delta anomalies (>25%): {n}
- Execution time: {seconds}s

## CONASAMI Wages Extracted
| Trade Code | Category | Zona General | Zona Frontera |
|---|---|---|---|
| ALBANIL | Albañil | $XXX.XX | $XXX.XX |
...

## Calculated Prices — Region 1 (Valle de México)
| Key | Cuadrilla | Calculated | Seed | Delta |
|---|---|---|---|---|
| 1P1E | Plomero + Ay.Esp | $X,XXX.XX | $2,158.47 | +X.X% |
...

## Fallbacks Used
- {TRADE_CODE}: used {FALLBACK} instead

## Anomalies (delta > 25%)
- {key}: calculated={X} vs seed={Y}, delta={Z}%

## Verification Queries Run
- AC-04: 407 records inserted ✓
- AC-05: All 37 cuadrillas have 11 regional prices ✓
- AC-06: Region 4 > Region 1 for all cuadrillas ✓
- AC-07: Max delta vs seed = X% ✓

## Next Steps
- Next annual update: January 1, 2026
- Cron schedule: 0 6 1 1 * (6am UTC-6 on January 1st)
```

---

## Appendix A: Execution Order

```
1. Fetch CONASAMI PDF (or web fallback)
2. Parse professional salary table → wages dict
3. Validate extraction (assertions)
4. Build trade wage lookup with fallbacks
5. Fetch insumo UUIDs from DB
6. Calculate all 407 prices (37 × 11)
7. Validate against Neodata seed (log anomalies)
8. Insert into precios table
9. Run post-insert verification SQL (Section 9.2)
10. Generate output report (Section 12)
```

## Appendix B: Annual Automation

After the first successful run, automate with this cron specification:

```bash
# Add to crontab on Hostinger VPS
# Runs at 6:00 AM Mexico City time (UTC-6) on January 1st
0 12 1 1 * cd /path/to/costbase && python scripts/update_labor_prices.py >> logs/labor_update_$(date +%Y).log 2>&1

# Also send Slack notification on completion
# Add to end of script: curl -X POST $SLACK_WEBHOOK -d '{"text":"Labor prices updated for {year}"}'
```

## Appendix C: Environment Variables Required

```bash
POSTGRES_DSN="postgresql://user:pass@host.neon.tech/costbase_mx?sslmode=require"
SLACK_WEBHOOK="https://hooks.slack.com/..."  # optional, for notifications
```
