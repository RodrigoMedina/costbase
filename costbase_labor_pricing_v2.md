# CostBase MX — Labor Pricing Correction
## Regional Extrapolation from Neodata Seed via ENOE State Multipliers

**Status:** Corrects failed attempt (v1.0 — CONASAMI minimums approach)  
**Priority:** HIGH  
**Estimated execution time:** 2–3 hours  
**Agent autonomy:** Full — execute all steps, report results at end  
**Version:** 2.0 — June 2025  

---

## Why v1.0 Failed — Read First

The previous PRD (v1.0) instructed the agent to use CONASAMI minimum wages as the base salary for cuadrilla pricing. This produced results 49–67% below the Neodata seed. **This was a design error.**

Two fundamental mistakes in v1.0:

**Mistake 1 — Wrong salary base.**
CONASAMI sets the legal minimum floor. Construction labor in Mexico operates at 90%+ informality. The market wage for a peón in CDMX is approximately $500–530/day (employer cost), not the $278.80 CONASAMI minimum. The Neodata seed ($893/JOR for 1 peón cuadrilla) back-calculates correctly:

```
$893.15 (seed) / 1.70 (FASAR) = $525/day base wage
$525 / $278.80 (CONASAMI) = 1.88× — workers earn 1.9× minimum in practice
```

**Mistake 2 — Wrong FASAR.**
The correct FASAR (Factor de Salario Real) for construction in Mexico is **1.65–1.80**, not 1.35. The full formula per RLOPSRM Article 191 includes Tp/Tl ratio (paid vs worked days ≈ 1.11) plus full employer social security burden (IMSS + INFONAVIT + SAR + risk premium ≈ 53–62%).

**The correct insight:**
The Neodata seed for Region 1 is already well-calibrated to the real market. It represents formal construction costs for CDMX including FASAR and market wages. **Do not recalculate it from scratch.** Use it as the anchor and derive the other 10 regions from official ENOE state wage data.

---

## Objective

Using the Neodata seed prices for Region 1 (Valle de México) as a calibrated baseline, derive labor prices for Regions 2–11 by applying **regional multipliers** calculated from INEGI ENOE construction worker wages by state. Insert 370 new price records (37 cuadrillas × 10 regions, Region 1 already has valid seed prices).

---

## Table of Contents

1. [Step 1 — Rollback v1.0 Failed Prices](#1-step-1--rollback-v10-failed-prices)
2. [Step 2 — Validate Region 1 Neodata Seed](#2-step-2--validate-region-1-neodata-seed)
3. [Step 3 — Fetch ENOE State Wages from Data México](#3-step-3--fetch-enoe-state-wages-from-data-méxico)
4. [Step 4 — Calculate Regional Multipliers](#4-step-4--calculate-regional-multipliers)
5. [Step 5 — The Reference Multiplier Table](#5-step-5--the-reference-multiplier-table)
6. [Step 6 — Calculate and Insert Regional Prices](#6-step-6--calculate-and-insert-regional-prices)
7. [Step 7 — Annual Update Mechanism](#7-step-7--annual-update-mechanism)
8. [SQL Verification Queries](#8-sql-verification-queries)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Edge Cases](#10-edge-cases)
11. [Output Report Format](#11-output-report-format)

---

## 1. Step 1 — Rollback v1.0 Failed Prices

**Execute this first before anything else.**

```sql
-- Remove all prices inserted by v1.0 (wrong CONASAMI-based values)
DELETE FROM precios
WHERE fuente_tipo = 'api_oficial'
  AND fecha = '2025-01-01'
  AND insumo_id IN (
    SELECT id FROM insumos WHERE tipo = 'mano_obra'
  );

-- Verify rollback: should return 0
SELECT COUNT(*) FROM precios
WHERE fuente_tipo = 'api_oficial'
  AND insumo_id IN (SELECT id FROM insumos WHERE tipo = 'mano_obra');
-- Expected result: 0
```

---

## 2. Step 2 — Validate Region 1 Neodata Seed

Before deriving other regions, confirm the Region 1 seed is intact and reasonable.

```sql
-- Check Region 1 seed prices for all 37 cuadrillas
SELECT
  i.clave_neodata,
  i.nombre,
  p.precio,
  p.fuente_tipo,
  p.confianza,
  p.fecha,
  -- Back-calculate implied base wage per worker
  ROUND(p.precio / 1.70 / CASE
    WHEN i.nombre LIKE '%1 PEON%' AND i.nombre NOT LIKE '%ALBAÑIL%' THEN 1
    WHEN i.nombre LIKE '1A1P%' OR i.nombre LIKE '1A1P%' THEN 2
    ELSE 2 END, 2) AS implied_wage_per_worker
FROM insumos i
JOIN precios p ON p.insumo_id = i.id
  AND p.region_id = 1
WHERE i.tipo = 'mano_obra'
ORDER BY p.precio DESC;

-- Expected: 37 rows with prices between $700 and $6,000
-- Expected: fuente_tipo = 'neodata_seed'
-- Red flag: any price below $700 or above $7,000 (investigate)
```

**Validation thresholds — if any seed fails these, stop and flag for manual review:**
- 1-worker cuadrillas: price must be between $700 and $1,600
- 2-worker cuadrillas: price must be between $1,800 and $3,200
- 3-worker cuadrillas: price must be between $2,500 and $4,500
- 6-worker cuadrilla (1A5P): price must be between $4,500 and $7,000

---

## 3. Step 3 — Fetch ENOE State Wages from Data México

INEGI's Data México platform provides construction worker average wages by state, derived from ENOE quarterly surveys. This is the most granular official data available.

### 3.1 Primary Data Source

**URL to fetch:** `https://www.economia.gob.mx/datamexico/es/profile/occupation/albaniles-y-otros-trabajadores-en-la-edificacion-de-construcciones`

**Method:** Web scrape or search for the state-level wage table on that page. Look for:
- Section: "Entidades federativas con mejores salarios promedio"
- Most recent quarter available (Q4 2024 or Q1 2025)
- Values in MXN monthly

**Target: collect average monthly wage for these states:**
```
CDMX (Ciudad de México)    — this is the denominator/reference
Chihuahua
Sonora
Sinaloa
Nuevo León
Quintana Roo
Baja California
Jalisco
Guanajuato
Querétaro
Morelos
Veracruz
Yucatán
Oaxaca
Guerrero
```

### 3.2 Fallback Search if Direct Scrape Fails

If the Data México page cannot be scraped directly, run a web search:
```
Query: "Data Mexico salario promedio albañiles construcción 2025 por entidad federativa"
Look for: tables or lists showing monthly wages by state
Source priority: economia.gob.mx > infobae.com > heraldodemexico.com.mx > elimparcial.com
```

### 3.3 Reference Values (Known Good — Use as Fallback)

If the live data cannot be fetched, use these validated values from Q1–Q3 2025 research:

```python
ENOE_WAGES_2025 = {
    # State: monthly average wage (MXN) for construction workers
    # Source: Data México / INEGI ENOE Q1-Q3 2025
    'CDMX':             7_430,   # our Region 1 reference
    'Estado de Mexico':  6_580,
    'Jalisco':           8_200,   # estimated from national data
    'Guanajuato':        7_800,
    'Nuevo Leon':        9_500,   # border proximity premium
    'Coahuila':          8_600,
    'Tamaulipas':        8_200,
    'Chihuahua':         9_100,   # border proximity
    'Sonora':            8_400,   # border proximity
    'Baja California':  11_500,   # ZLFN, high demand
    'Baja California Sur': 15_300, # tourism boom (highest nationally)
    'Nayarit':          14_300,   # tourism boom
    'Quintana Roo':     12_700,   # tourism boom
    'Yucatan':          10_200,   # Mayan Train infrastructure boom
    'Veracruz':          7_100,
    'Puebla':            7_000,
    'Morelos':           7_200,
    'Guerrero':          7_800,   # Acapulco reconstruction
    'Oaxaca':            6_200,   # lower cost region
    'Chiapas':           5_900,   # lowest nationally
    'Queretaro':         8_400,   # industrial corridor
    'Michoacan':         7_000,
    'Tabasco':           7_600,
    'Campeche':          8_100,
    'Sinaloa':           7_800,
    'Durango':           7_500,
    'Aguascalientes':    7_900,
    'Colima':            8_600,
    'Hidalgo':           6_900,
    'Tlaxcala':          6_600,
    'Zacatecas':         7_300,
    'San Luis Potosi':   7_500,
}
```

> **Important:** These are WORKER take-home wages (what ENOE captures). They are used only as **relative multipliers** vs CDMX — not as absolute pricing inputs. The absolute prices come from the Neodata Region 1 seed.

---

## 4. Step 4 — Calculate Regional Multipliers

### 4.1 Multiplier Formula

```python
def state_multiplier(state: str, enoe_wages: dict) -> float:
    """
    Calculate the wage multiplier for a state relative to CDMX.
    This multiplier is applied to Region 1 seed prices to get regional prices.
    
    CDMX = 1.00 (reference)
    States with higher construction wages get multiplier > 1.00
    States with lower construction wages get multiplier < 1.00
    """
    cdmx_wage  = enoe_wages['CDMX']        # 7,430
    state_wage = enoe_wages.get(state, cdmx_wage)  # fallback to CDMX if missing
    return round(state_wage / cdmx_wage, 4)
```

### 4.2 Region → States Aggregation

Each of Neodata's 11 regions covers multiple states. Use the weighted average of state multipliers for each region:

```python
REGION_STATES = {
    1:  ['CDMX', 'Estado de Mexico', 'Hidalgo'],
    2:  ['Chihuahua', 'Sonora', 'Sinaloa', 'Durango'],
    3:  ['Nuevo Leon', 'Coahuila', 'Tamaulipas'],
    4:  ['Baja California'],           # ZLFN — all municipalities qualify
    5:  ['Jalisco', 'Colima', 'Nayarit', 'Aguascalientes'],
    6:  ['Guanajuato', 'Queretaro', 'Michoacan', 'San Luis Potosi'],
    7:  ['Morelos', 'Guerrero', 'Puebla', 'Tlaxcala'],
    8:  ['Oaxaca', 'Chiapas'],
    9:  ['Veracruz', 'Tabasco'],
    10: ['Yucatan', 'Campeche', 'Quintana Roo'],
    11: ['Michoacan', 'Guerrero'],     # coastal strip only
}

def region_multiplier(region_id: int, enoe_wages: dict) -> float:
    """Average the state multipliers for a region."""
    states = REGION_STATES[region_id]
    multipliers = [state_multiplier(s, enoe_wages) for s in states]
    return round(sum(multipliers) / len(multipliers), 4)
```

---

## 5. Step 5 — The Reference Multiplier Table

Using the fallback values from Section 3.3, these are the expected multipliers. If you fetched live data, recalculate and replace these. **Show this table in the output report so the human can verify it looks reasonable.**

| Region | States included | Expected multiplier | Rationale |
|--------|----------------|---------------------|-----------|
| 1 | CDMX, EdoMex, Hidalgo | 1.00 (reference) | Base anchor |
| 2 | Chihuahua, Sonora, Sinaloa, Durango | ~1.17 | Border proximity premium in CHI/SON |
| 3 | Nuevo León, Coahuila, Tamaulipas | ~1.22 | Industrial/border premium (Monterrey) |
| 4 | Baja California | ~1.55 | ZLFN + US proximity, highest formal wages |
| 5 | Jalisco, Colima, Nayarit, Aguascalientes | ~1.32 | Nayarit tourism boom drives average up |
| 6 | Guanajuato, Querétaro, Michoacán, SLP | ~1.03 | Industrial corridor, close to national average |
| 7 | Morelos, Guerrero, Puebla, Tlaxcala | ~0.99 | Mix of lower-cost states |
| 8 | Oaxaca, Chiapas | ~0.83 | Lowest wages nationally |
| 9 | Veracruz, Tabasco | ~0.96 | Slightly below CDMX |
| 10 | Yucatán, Campeche, Quintana Roo | ~1.35 | Tourism boom, Mayan Train infrastructure |
| 11 | Michoacán Costa, Guerrero Norte | ~0.97 | Lower-cost coastal areas |

> **Reality check:** Region 4 (Baja California) and Region 10 (Peninsula) being MORE expensive than CDMX is correct and expected — tourism infrastructure booms + US border proximity drive up construction wages significantly. Region 8 (Oaxaca/Chiapas) being 83% of CDMX is also correct — these are the lowest-wage states in Mexico.

---

## 6. Step 6 — Calculate and Insert Regional Prices

```python
import psycopg2
import os
from datetime import date

conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
cur  = conn.cursor()

# Get all 37 cuadrillas with their Region 1 seed prices
cur.execute("""
    SELECT i.id, i.clave_neodata, i.nombre, p.precio
    FROM insumos i
    JOIN precios p ON p.insumo_id = i.id
      AND p.region_id = 1
      AND p.fuente_tipo = 'neodata_seed'
    WHERE i.tipo = 'mano_obra'
    ORDER BY p.precio DESC
""")
cuadrillas_r1 = cur.fetchall()
print(f"Found {len(cuadrillas_r1)} cuadrillas with Region 1 seed prices")

# Fetch live ENOE data or use fallback (see Step 3)
enoe_wages = ENOE_WAGES_2025  # fallback dict from Section 3.3
# If live data was fetched successfully, replace with actual values

# Calculate and insert prices for Regions 2-11
inserts = []
price_log = []  # for the output report

for insumo_id, clave, nombre, r1_price in cuadrillas_r1:
    for region_id in range(2, 12):  # Regions 2 through 11
        multiplier = region_multiplier(region_id, enoe_wages)
        derived_price = round(float(r1_price) * multiplier, 2)

        inserts.append((
            insumo_id,
            region_id,
            derived_price,
            'MXN',
            'https://www.economia.gob.mx/datamexico',   # fuente_url
            'regional_derivation',                       # fuente_tipo
            0.60,                                        # confianza
            date(2025, 1, 1),                            # effective date
        ))

        price_log.append({
            'clave': clave,
            'region': region_id,
            'r1_price': float(r1_price),
            'multiplier': multiplier,
            'derived_price': derived_price,
        })

# Bulk insert
cur.executemany("""
    INSERT INTO precios
        (id, insumo_id, region_id, precio, moneda, fuente_url, fuente_tipo, confianza, fecha)
    VALUES
        (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
""", inserts)

conn.commit()
print(f"Inserted {len(inserts)} price records")  # Expected: 370 (37 × 10)
conn.close()
```

---

## 7. Step 7 — Annual Update Mechanism

Labor prices update on **January 1st each year**. The process is simpler than v1.0:

```python
# annual_update_labor.py — Run January 1-15 each year
import psycopg2
from datetime import date

CONASAMI_INCREASE_PCT = {
    # Update this each December when CONASAMI announces the new year's increase
    2026: 0.130,  # 13% — update with actual value when announced
    2025: 0.120,  # 12% — confirmed
    2024: 0.200,  # 20%
    2023: 0.200,  # 20%
}

def apply_annual_increase(year: int):
    """
    Apply the CONASAMI annual % increase to all labor prices.
    This tracks real wage inflation closely since informal wages
    tend to follow minimum wage increases.
    """
    increase = CONASAMI_INCREASE_PCT[year]
    conn = psycopg2.connect(os.getenv('POSTGRES_DSN'))
    cur  = conn.cursor()

    # Step 1: Update Region 1 seed price
    cur.execute("""
        UPDATE precios
        SET precio = ROUND(precio * %s, 2),
            fecha  = %s
        WHERE region_id = 1
          AND fuente_tipo = 'neodata_seed'
          AND insumo_id IN (SELECT id FROM insumos WHERE tipo = 'mano_obra')
    """, (1 + increase, date(year, 1, 1)))

    # Step 2: Update all derived regional prices
    cur.execute("""
        UPDATE precios
        SET precio = ROUND(precio * %s, 2),
            fecha  = %s
        WHERE fuente_tipo = 'regional_derivation'
          AND insumo_id IN (SELECT id FROM insumos WHERE tipo = 'mano_obra')
    """, (1 + increase, date(year, 1, 1)))

    conn.commit()
    print(f"Applied {increase*100:.1f}% increase to all labor prices for {year}")
    conn.close()
```

> **Why this works:** CONASAMI minimum wage increases in Mexico have tracked actual informal construction wage increases closely (both have been 12–20% per year since 2020). Using the CONASAMI % as the inflation factor for updating prices is a defensible, simple, and well-sourced approach.

**Cron schedule (Hostinger VPS):**
```bash
# 6am Mexico City time (UTC-6), January 5th each year
0 12 5 1 * cd /path/to/costbase && python scripts/annual_update_labor.py 2>&1 >> logs/labor_update.log
```

---

## 8. SQL Verification Queries

Run these after completing Step 6:

```sql
-- 8.1 Check total price records for labor
SELECT
    fuente_tipo,
    COUNT(*) AS total_records,
    COUNT(DISTINCT insumo_id) AS cuadrillas_covered,
    COUNT(DISTINCT region_id) AS regions_covered
FROM precios
WHERE insumo_id IN (SELECT id FROM insumos WHERE tipo = 'mano_obra')
GROUP BY fuente_tipo;
-- Expected:
-- neodata_seed      | 37 records | 37 cuadrillas | 1 region (Region 1 only)
-- regional_derivation| 370 records | 37 cuadrillas | 10 regions (2-11)

-- 8.2 Verify all 37 cuadrillas have all 11 regions
SELECT
    i.clave_neodata,
    i.nombre,
    COUNT(p.region_id) AS n_regions,
    MIN(p.precio) AS min_price,
    MAX(p.precio) AS max_price,
    ROUND(MAX(p.precio) / MIN(p.precio), 2) AS max_min_ratio
FROM insumos i
JOIN precios p ON p.insumo_id = i.id
WHERE i.tipo = 'mano_obra'
GROUP BY i.id, i.clave_neodata, i.nombre
ORDER BY MAX(p.precio) DESC;
-- Expected: all rows show n_regions = 11
-- Expected: max_min_ratio between 1.4 and 2.0 (regional spread is meaningful but not extreme)

-- 8.3 Verify regional ordering makes economic sense
SELECT
    r.nombre AS region,
    ROUND(AVG(p.precio), 2) AS avg_labor_price,
    ROUND(AVG(p.precio) / (
        SELECT AVG(p2.precio)
        FROM precios p2
        JOIN insumos i2 ON p2.insumo_id = i2.id
        WHERE i2.tipo = 'mano_obra' AND p2.region_id = 1
    ) * 100, 1) AS pct_of_cdmx
FROM precios p
JOIN regiones r ON p.region_id = r.id
JOIN insumos i ON p.insumo_id = i.id
WHERE i.tipo = 'mano_obra'
GROUP BY p.region_id, r.nombre
ORDER BY avg_labor_price DESC;
-- Expected ordering (highest to lowest):
-- Region 4 (Noroeste/BC)   ~150-160% of CDMX
-- Region 10 (Península)    ~130-140% of CDMX
-- Region 5 (Occidente)     ~125-135% of CDMX (Nayarit drives this up)
-- Region 3 (Noreste)       ~120-125% of CDMX
-- Region 2 (Norte)         ~115-120% of CDMX
-- Region 1 (Valle de Méx)  100% (reference)
-- Region 6 (Bajío)         ~100-105% of CDMX
-- Region 7 (Centro-Sur)    ~95-100% of CDMX
-- Region 9 (Sureste)       ~92-98% of CDMX
-- Region 11 (Pacífico Cen) ~92-98% of CDMX
-- Region 8 (Sur)           ~80-88% of CDMX (Oaxaca/Chiapas — lowest)

-- 8.4 Spot-check: 1-peón cuadrilla across regions
SELECT
    r.nombre,
    p.precio,
    p.fuente_tipo,
    p.confianza
FROM precios p
JOIN regiones r ON p.region_id = r.id
JOIN insumos i ON p.insumo_id = i.id
WHERE i.clave_neodata = '1P'
ORDER BY p.precio DESC;
-- Expected: R4 highest (~$1,380), R8 lowest (~$740), R1 $893 in middle
```

---

## 9. Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|--------------|
| AC-01 | v1.0 prices fully rolled back | Query after rollback returns 0 rows |
| AC-02 | Region 1 seed intact (37 records) | Step 2 query returns 37 rows |
| AC-03 | All 37 Region 1 seed prices within expected ranges | Step 2 thresholds all pass |
| AC-04 | 370 new records inserted (37 × 10 regions) | Section 8.1 shows regional_derivation = 370 |
| AC-05 | All cuadrillas have 11 regional prices | Section 8.2 all n_regions = 11 |
| AC-06 | Region 4 (BC) is the highest-priced region | Section 8.3 ordering correct |
| AC-07 | Region 8 (Oaxaca/Chiapas) is the lowest non-1 priced region | Section 8.3 ordering correct |
| AC-08 | Max/min ratio per cuadrilla is 1.4–2.0 (no extreme outliers) | Section 8.2 max_min_ratio column |
| AC-09 | fuente_tipo = 'regional_derivation', confianza = 0.60 | Section 8.1 |
| AC-10 | Output report delivered with multiplier table | See Section 11 |

---

## 10. Edge Cases

### 10.1 Live ENOE Data Not Fetchable

Use the fallback table in Section 3.3 without modification. Log it as:
```
DATA_SOURCE: fallback_table (live ENOE fetch failed)
CONFIDENCE_NOTE: Using Q1-Q3 2025 reference values; actual values may differ ±10%
```

### 10.2 State Not Found in ENOE Data

If a specific state has no ENOE wage data, use the national average:
```python
national_avg = 8_830  # MXN/month, Q1 2025
fallback_multiplier = national_avg / enoe_wages['CDMX']  # 8830/7430 = 1.188
```

### 10.3 Region 5 Outlier

Region 5 (Occidente) includes Nayarit ($14,300/month), which is extremely high due to tourism. This will make Region 5 multiplier (~1.32) higher than Region 3 (Noreste, ~1.22), which feels counterintuitive. This is **correct** — Nayarit genuinely has high construction wages due to Riviera Nayarit resort development. If the human finds this unreasonable, they can override with multiplier = 1.10 for Region 5. Log it clearly in the output report so the human can decide.

### 10.4 Regions with Very Different States

Region 6 (Bajío) contains both high-wage Querétaro and lower-wage Michoacán. The average multiplier (~1.03) reflects this mix. This is acceptable — Neodata itself uses a single price per region, not per city.

---

## 11. Output Report Format

```markdown
# Labor Pricing v2.0 — Execution Report
Date: {execution_date}

## Summary
- v1.0 prices rolled back: {n} records deleted
- Region 1 seed validated: 37 / 37 cuadrillas ✓
- New regional prices inserted: {n} (expected: 370)
- Data source: {live ENOE / fallback table}

## ENOE Multiplier Table Applied
| Region | States | ENOE Multiplier | Source |
|--------|--------|----------------|--------|
| 1  | CDMX reference | 1.0000 | Neodata seed |
| 2  | Norte          | X.XXXX | ENOE/fallback |
| 3  | Noreste        | X.XXXX | ENOE/fallback |
| 4  | Noroeste (BC)  | X.XXXX | ENOE/fallback |
| 5  | Occidente      | X.XXXX | ENOE/fallback |
| 6  | Bajío          | X.XXXX | ENOE/fallback |
| 7  | Centro-Sur     | X.XXXX | ENOE/fallback |
| 8  | Sur            | X.XXXX | ENOE/fallback |
| 9  | Sureste        | X.XXXX | ENOE/fallback |
| 10 | Península      | X.XXXX | ENOE/fallback |
| 11 | Pacífico Cen   | X.XXXX | ENOE/fallback |

## Sample Prices — 1-Peón Cuadrilla (1P) Across Regions
| Region | Price (MXN/JOR) | vs Region 1 |
|--------|----------------|-------------|
| 4 (BC) | $X,XXX.XX | +XX% |
| 1 (CDMX) | $893.15 | 100% (seed) |
| 8 (Sur) | $XXX.XX | -XX% |

## Acceptance Criteria
- AC-01 Rollback: ✓/✗
- AC-02 Region 1 intact: ✓/✗
- AC-03 Seed ranges valid: ✓/✗
- AC-04 370 records inserted: ✓/✗ (actual: N)
- AC-05 All 11 regions per cuadrilla: ✓/✗
- AC-06 Region 4 highest: ✓/✗
- AC-07 Region 8 lowest: ✓/✗
- AC-08 Max/min ratio 1.4-2.0: ✓/✗

## Flags for Human Review
- Region 5 (Occidente) multiplier {X.XX} — is Nayarit tourism premium acceptable? Override with 1.10 if not.
- {any other anomalies}

## What This Pricing Represents
These prices are employer total cost per JOR (jornada). They are derived from
Neodata Region 1 calibrated market prices, scaled by ENOE relative construction
wages by state. They represent formal construction sector costs including FASAR
(~1.70×) applied to market wages. They do NOT reflect informal day-labor rates,
which are 30-50% lower in most regions.

## Next Annual Update
- Date: January 5, 2026
- Action: Apply CONASAMI 2026 increase % to ALL labor prices
- CONASAMI 2026 increase: 13% (update if actual value differs)
- Script: scripts/annual_update_labor.py 2026
```

---

## Appendix A: Execution Order

```
1.  Run Section 1 rollback SQL  →  verify returns 0
2.  Run Section 2 validation SQL  →  verify 37 rows, all in range
3.  Attempt live ENOE fetch (Section 3.1)
4.  If fetch fails: use fallback table (Section 3.3)
5.  Calculate regional multipliers (Section 4)
6.  Print multiplier table for review (Section 5)
7.  Calculate and insert 370 price records (Section 6)
8.  Run all 4 verification queries (Section 8)
9.  Generate output report (Section 11)
```

## Appendix B: Key Conceptual Differences from v1.0

| Aspect | v1.0 (Wrong) | v2.0 (Correct) |
|--------|-------------|----------------|
| Base salary source | CONASAMI minimum wage | Neodata Region 1 seed (market-calibrated) |
| FASAR used | 1.35 | Already embedded in Neodata seed (≈1.70) |
| Region 1 handling | Recalculated from scratch | Preserved as authoritative anchor |
| Regional variation source | CONASAMI zones only | ENOE state construction wages |
| Expected accuracy | ±50-67% off | ±10-15% (inherent in survey data) |
| Confidence score | 0.95 (overconfident) | 0.60 (appropriately uncertain) |
| Update mechanism | Re-parse PDF annually | Apply CONASAMI % increase annually |
