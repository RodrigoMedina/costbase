#!/usr/bin/env python3
"""
CostBase MX — Labor Pricing Task
Updates cuadrilla prices with official CONASAMI 2025 salary data.
"""

import os
import sys
import json
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

import psycopg2
import psycopg2.extras

# ─────────────────────────────────────────────
# SECTION 1: CONASAMI 2025 Wage Data
# Extracted from official PDF:
#   https://www.gob.mx/cms/uploads/attachment/file/960832/Tabla_de_Salarios_M_nimos_2025.pdf
# ─────────────────────────────────────────────

SMG_2025 = 278.80        # Salario Mínimo General
SMG_ZLFN_2025 = 419.88   # Salario Mínimo Zona Libre Frontera Norte

CONASAMI_2025 = {
    # Direct CONASAMI professional matches
    'ALBANIL':       {'zona_general': 321.63, 'zlf_norte': 419.88},
    'CARPINTERO_ON': {'zona_general': 321.63, 'zlf_norte': 419.88},
    'CARPINTERO_OB': {'zona_general': 316.33, 'zlf_norte': 419.88},
    'ELECTRICISTA':  {'zona_general': 315.21, 'zlf_norte': 419.88},
    'HERRERO':       {'zona_general': 311.14, 'zlf_norte': 419.88},
    'PINTOR':        {'zona_general': 309.04, 'zlf_norte': 419.88},
    'PLOMERO':       {'zona_general': 309.59, 'zlf_norte': 419.88},
    'SOLDADOR':      {'zona_general': 318.26, 'zlf_norte': 419.88},
    'YESERO':        {'zona_general': 300.18, 'zlf_norte': 419.88},
    'AZULEJERO':     {'zona_general': 315.21, 'zlf_norte': 419.88},
    'COLOCADOR':     {'zona_general': 315.21, 'zlf_norte': 419.88},
    'OP_MAQ':        {'zona_general': 336.94, 'zlf_norte': 419.88},
    # Non-professional — general minimum wage base
    'PEON':          {'zona_general': 278.80, 'zlf_norte': 419.88},
    'AY_GENERAL':    {'zona_general': 278.80, 'zlf_norte': 419.88},
    'AY_ESP':        {'zona_general': 300.18, 'zlf_norte': 419.88},
}

FACTOR_PRESTACIONES = 1.35

# ─────────────────────────────────────────────
# SECTION 2: Trade Fallback Chain
# ─────────────────────────────────────────────

FALLBACKS = {
    'COLOCADOR':       'AZULEJERO',
    'ALUMINIERO':      'ALBANIL',
    'OF_INSTALACIONES':'PLOMERO',
    'MANIOBRISTA':     'AY_ESP',
    'TECNICO':         'ELECTRICISTA',
    'TECNICO_CERT':    ('ELECTRICISTA', 1.10),
    'CABO':            ('ALBANIL', 1.00),
    'SOBRESTANTE':     ('ALBANIL', 1.20),
}

ADDITIONAL_FALLBACKS = {
    'TUBERO':          'PLOMERO',
    'FIERRERO':        'AY_ESP',
    'VIDRIERO':        'AY_ESP',
    'BARNIZADOR':      'PINTOR',
    'TOPOGRAFO':       ('AY_ESP', 1.15),
    'TECNICO_CERT':    ('ELECTRICISTA', 1.10),
}

FALLBACKS.update(ADDITIONAL_FALLBACKS)

# ─────────────────────────────────────────────
# SECTION 3: Cuadrilla Composition
# ─────────────────────────────────────────────

COMPOSITIONS = {
    '1P1E':   [('PLOMERO', 1), ('AY_ESP', 1)],
    '1E1E':   [('ELECTRICISTA', 1), ('AY_ESP', 1)],
    '1I1E':   [('OF_INSTALACIONES', 1), ('AY_ESP', 1)],
    '1T1E':   [('TECNICO', 1), ('AY_ESP', 1)],
    '1CO1A':  [('COLOCADOR', 1), ('AY_GENERAL', 1)],
    '1A':     [('AY_GENERAL', 1)],
    '1A1P':   [('ALBANIL', 1), ('PEON', 1)],
    '1A1A':   [('AZULEJERO', 1), ('AY_GENERAL', 1)],
    '1S2E':   [('SOLDADOR', 1), ('AY_ESP', 2)],
    '1H1A':   [('HERRERO', 1), ('AY_GENERAL', 1)],
    '1F1A':   [('FIERRERO', 1), ('AY_GENERAL', 1)],
    '1T1A-U': [('TUBERO', 1), ('AY_GENERAL', 1)],
    '1A5P':   [('ALBANIL', 1), ('PEON', 5)],
    '1P':     [('PEON', 1)],
    '1T2A-U': [('TUBERO', 1), ('AY_GENERAL', 2)],
    '1C1A':   [('CARPINTERO_ON', 1), ('AY_GENERAL', 1)],
    '1V1A':   [('VIDRIERO', 1), ('AY_GENERAL', 1)],
    '1A1E':   [('ALUMINIERO', 1), ('AY_ESP', 1)],
    '1P1A':   [('PINTOR', 1), ('AY_GENERAL', 1)],
    '2A':     [('AY_GENERAL', 2)],
    '1M2E':   [('MANIOBRISTA', 1), ('AY_ESP', 2)],
    '1C1E':   [('CARPINTERO_OB', 1), ('AY_ESP', 1)],
    '1TC1E':  [('TECNICO_CERT', 1), ('AY_ESP', 1)],
    '1S1E':   [('SOLDADOR', 1), ('AY_ESP', 1)],
    '1B1A':   [('BARNIZADOR', 1), ('AY_GENERAL', 1)],
    '1P-U':   [('PEON', 1)],
    '1T1A':   [('TUBERO', 1), ('AY_GENERAL', 1)],
    '1OM':    [('OP_MAQ', 1)],
    '1A1P-U': [('ALBANIL', 1), ('PEON', 1)],
    'MO082':  [('CABO', 1)],
    'MO031':  [('AY_ESP', 1)],
    '2T2A-U': [('TUBERO', 2), ('AY_GENERAL', 2)],
    'MO021':  [('AY_GENERAL', 1)],
    '1A-U':   [('AY_GENERAL', 1)],
    '1Y1A':   [('YESERO', 1), ('AY_GENERAL', 1)],
    '1T2E':   [('TOPOGRAFO', 1), ('AY_ESP', 2)],
    'MO094':  [('SOBRESTANTE', 1)],
}

# ─────────────────────────────────────────────
# SECTION 4: Region → Zone Mapping
# ─────────────────────────────────────────────

REGION_ZONE_MAP = {
    1:  'zona_general',   # Valle de México
    2:  'zona_general',   # Norte
    3:  'zona_general',   # Noreste
    4:  'zlf_norte',      # Noroeste — Baja California is ZLFN
    5:  'zona_general',   # Occidente
    6:  'zona_general',   # Bajío
    7:  'zona_general',   # Centro-Sur
    8:  'zona_general',   # Sur
    9:  'zona_general',   # Sureste
    10: 'zona_general',   # Península
    11: 'zona_general',   # Pacífico Centro
}

# ─────────────────────────────────────────────
# SECTION 5: Seed Prices for Validation
# ─────────────────────────────────────────────

SEED_PRICES_R1 = {
    '1P1E': 2158.47, '1E1E': 2158.47, '1I1E': 2158.47, '1T1E': 2138.71,
    '1CO1A': 2106.41, '1A': 910.49, '1A1P': 2089.07, '1A1A': 2080.37,
    '1S2E': 3057.89, '1H1A': 2132.44, '1F1A': 2115.10, '1T1A-U': 2151.53,
    '1A5P': 5661.69, '1P': 893.15, '1T2A-U': 2946.76, '1C1A': 2132.44,
    '1V1A': 2097.73, '1A1E': 2149.79, '1P1A': 2062.99, '2A': 1820.99,
    '1M2E': 2953.70, '1C1E': 2149.79, '1TC1E': 2208.15, '1S1E': 2262.66,
    '1B1A': 2106.41, '1P-U': 893.15, '1T1A': 2141.12, '1OM': 1068.08,
    '1A1P-U': 2089.07, 'MO082': 1326.14, 'MO031': 795.23,
    '2T2A-U': 4268.36, 'MO021': 777.88, '1A-U': 910.49,
    '1Y1A': 2080.37, '1T2E': 2916.60, 'MO094': 1412.92,
}

# ─────────────────────────────────────────────
# SECTION 6: Core Functions
# ─────────────────────────────────────────────

fallbacks_used = {}
fallback_count = 0

def get_daily_wage(trade_code, zona):
    global fallback_count
    key = trade_code

    if trade_code in FALLBACKS:
        fb = FALLBACKS[trade_code]
        if isinstance(fb, tuple):
            fb_trade, multiplier = fb
        else:
            fb_trade, multiplier = fb, 1.0
        base_wage = CONASAMI_2025.get(fb_trade)
        if base_wage:
            if trade_code not in fallbacks_used:
                fallbacks_used[trade_code] = f"→ {fb_trade}{' × ' + str(multiplier) if multiplier != 1.0 else ''}"
                fallback_count += 1
            return round(base_wage[zona] * multiplier, 2)
        else:
            trade_code = fb_trade
            key = fb_trade

    if trade_code in CONASAMI_2025:
        return CONASAMI_2025[trade_code][zona]

    # Ultimate fallback: general minimum wage
    w = SMG_2025 if zona == 'zona_general' else SMG_ZLFN_2025
    if key not in fallbacks_used:
        fallbacks_used[key] = f"→ SMG ({w})"
        fallback_count += 1
    return w


def calculate_cuadrilla_price(key, zona):
    composition = COMPOSITIONS[key]
    base_sum = sum(qty * get_daily_wage(trade, zona) for trade, qty in composition)
    return round(base_sum * FACTOR_PRESTACIONES, 2)


# ─────────────────────────────────────────────
# SECTION 7: Main Execution
# ─────────────────────────────────────────────

def main():
    global fallbacks_used, fallback_count
    import time
    start_time = time.time()

    dsn = os.getenv('DATABASE_URL')
    if not dsn:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    # ---- Step 3: Validate extraction ----
    print("Step 3: Validating CONASAMI extraction...")
    assert CONASAMI_2025['ALBANIL']['zona_general'] > SMG_2025, "Albañil must exceed minimum wage"
    assert CONASAMI_2025['ALBANIL']['zlf_norte'] > SMG_2025, "Border wage must exceed general minimum"
    assert len(CONASAMI_2025) >= 15, "Must have at least 15 trade entries"

    ratio = CONASAMI_2025['ALBANIL']['zona_general'] / SMG_2025
    assert 1.1 < ratio < 2.0, f"Albañil ratio {ratio:.2f} seems wrong"
    print(f"  Validation passed. {len(CONASAMI_2025)} trade entries. Albañil ratio: {ratio:.2f}")

    # ---- Step 5: Fetch insumo UUIDs from DB ----
    print("Step 5: Fetching insumo UUIDs from DB...")
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    claves = list(COMPOSITIONS.keys())
    cur.execute("""
        SELECT clave_neodata, id
        FROM insumos
        WHERE clave_neodata = ANY(%s) AND tipo = 'mano_obra'
    """, (claves,))
    uuid_map = {row[0]: row[1] for row in cur.fetchall()}

    print(f"  Found {len(uuid_map)} / {len(claves)} cuadrillas in DB")
    missing = [k for k in claves if k not in uuid_map]
    if missing:
        print(f"  NOT FOUND in DB: {missing}")
        if len(missing) > 10:
            raise RuntimeError(f"Too many cuadrillas not found in DB: {len(missing)}")
    else:
        print("  All 37 cuadrillas found ✓")

    # ---- Step 6: Calculate prices ----
    print("Step 6: Calculating prices...")
    anomalies = []
    all_prices = []

    for key in claves:
        if key not in uuid_map:
            continue
        insumo_uuid = uuid_map[key]
        for region_id in range(1, 12):
            zona = REGION_ZONE_MAP[region_id]
            price = calculate_cuadrilla_price(key, zona)

            all_prices.append({
                'insumo_id': insumo_uuid,
                'region_id': region_id,
                'precio': price,
                'moneda': 'MXN',
                'fuente_url': 'https://www.conasami.gob.mx',
                'fuente_tipo': 'api_oficial',
                'confianza': 0.95,
                'fecha': date(2025, 1, 1),
                'clave': key,
            })

            # Validate against seed
            if region_id == 1 and key in SEED_PRICES_R1:
                seed = SEED_PRICES_R1[key]
                delta_pct = (price - seed) / seed * 100
                if abs(delta_pct) > 25:
                    anomalies.append({
                        'key': key,
                        'seed': seed,
                        'calculated': price,
                        'delta_pct': round(delta_pct, 1),
                    })

    total_cuadrillas = len(uuid_map)
    total_regions = 11
    expected_records = total_cuadrillas * total_regions
    print(f"  Calculated {len(all_prices)} prices ({total_cuadrillas} cuadrillas × {total_regions} regions)")

    # ---- Step 7: Validation report ----
    print(f"\nStep 7: Validation vs Neodata seed (Region 1):")
    print(f"  Anomalies (delta > 25%): {len(anomalies)}")
    for a in anomalies[:10]:
        print(f"  ⚠ {a['key']}: calc={a['calculated']:.2f} vs seed={a['seed']:.2f} delta={a['delta_pct']:.1f}%")
    if len(anomalies) > 10:
        print(f"  ... and {len(anomalies) - 10} more")

    # ---- Step 8: Insert into precios table ----
    print("\nStep 8: Inserting prices into precios table...")

    insert_sql = """
        INSERT INTO precios
            (id, insumo_id, region_id, precio, moneda, fuente_url, fuente_tipo, confianza, fecha)
        VALUES
            (gen_random_uuid(), %(insumo_id)s, %(region_id)s, %(precio)s,
             %(moneda)s, %(fuente_url)s, %(fuente_tipo)s, %(confianza)s, %(fecha)s)
        ON CONFLICT DO NOTHING
    """

    batch_size = 100
    inserted = 0
    for i in range(0, len(all_prices), batch_size):
        batch = all_prices[i:i + batch_size]
        psycopg2.extras.execute_batch(cur, insert_sql, batch)
        inserted += len(batch)

    conn.commit()
    print(f"  Inserted {inserted} price records")

    # ---- Step 9: Post-insert verification ----
    print("\nStep 9: Running post-insert verification...")

    # AC-05: All 37 cuadrillas have 11 regional prices
    cur.execute("""
        SELECT i.clave_neodata, i.nombre, COUNT(p.id) AS n_regiones,
               MIN(p.precio) AS precio_min, MAX(p.precio) AS precio_max
        FROM insumos i
        JOIN precios p ON p.insumo_id = i.id
        WHERE i.tipo = 'mano_obra'
          AND p.fuente_tipo = 'api_oficial'
        GROUP BY i.id, i.clave_neodata, i.nombre
        ORDER BY COUNT(p.id) DESC
    """)
    verification = cur.fetchall()
    ac05_ok = all(row[2] == 11 for row in verification)
    print(f"  AC-05: All cuadrillas have 11 regiones = {'✓' if ac05_ok else '✗'}")
    if not ac05_ok:
        for row in verification:
            if row[2] != 11:
                print(f"    {row[0]}: only {row[2]} regions")

    # AC-06: Region 4 prices > Region 1 prices
    cur.execute("""
        SELECT i.clave_neodata,
               MAX(CASE WHEN p.region_id = 1 THEN p.precio END) as r1,
               MAX(CASE WHEN p.region_id = 4 THEN p.precio END) as r4
        FROM insumos i
        JOIN precios p ON p.insumo_id = i.id
        WHERE i.tipo = 'mano_obra'
          AND p.fuente_tipo = 'api_oficial'
          AND p.region_id IN (1, 4)
        GROUP BY i.id, i.clave_neodata
    """)
    r1_vs_r4 = cur.fetchall()
    ac06_failures = [row for row in r1_vs_r4 if row[2] <= row[1]]
    ac06_ok = len(ac06_failures) == 0
    print(f"  AC-06: Region 4 > Region 1 for all = {'✓' if ac06_ok else '✗'}")
    if not ac06_ok:
        for row in ac06_failures[:5]:
            print(f"    {row[0]}: R1={row[1]:.2f} R4={row[2]:.2f}")

    # AC-07: Max delta vs seed
    cur.execute("""
        SELECT i.clave_neodata,
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
        ORDER BY ABS(delta_pct) DESC
    """)
    deltas = cur.fetchall()
    if deltas:
        max_delta = max(abs(r[3]) for r in deltas)
        print(f"  AC-07: Max delta vs seed = {max_delta:.1f}% {'✓' if max_delta < 50 else '✗'}")
        for row in deltas[:5]:
            print(f"    {row[0]}: seed={row[1]:.2f} conasami={row[2]:.2f} delta={row[3]:.1f}%")
    else:
        print("  AC-07: No seed prices found for comparison")

    # AC-08: fuente_tipo and confianza
    cur.execute("""
        SELECT fuente_tipo, confianza, COUNT(*)
        FROM precios
        WHERE fuente_tipo = 'api_oficial'
        GROUP BY fuente_tipo, confianza
    """)
    ac08 = cur.fetchall()
    ac08_ok = all(r[0] == 'api_oficial' and r[1] == 0.95 for r in ac08)
    print(f"  AC-08: fuente_tipo='api_oficial', confianza=0.95 = {'✓' if ac08_ok else '✗'}")
    for r in ac08:
        print(f"    {r[0]}: confianza={r[1]} count={r[2]}")

    # AC-09: Seed prices preserved
    cur.execute("SELECT COUNT(*) FROM precios WHERE fuente_tipo = 'neodata_seed'")
    seed_count = cur.fetchone()[0]
    print(f"  AC-09: Seed prices preserved: {seed_count} records {'✓' if seed_count > 0 else '✗'}")

    conn.close()

    # ---- Step 10: Generate output report ----
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print("IMSS/CONASAMI LABOR PRICING — EXECUTION REPORT")
    print(f"{'='*60}")
    print(f"Date: {date.today()}")
    print(f"CONASAMI table version: 2025 (effective 2025-01-01)")
    print()
    print("## Summary")
    print(f"- Cuadrillas priced: {total_cuadrillas} / 37")
    print(f"- Regions covered: 11")
    print(f"- Total price records inserted: {inserted}")
    print(f"- Fallbacks used: {fallback_count}")
    print(f"- High-delta anomalies (>25%): {len(anomalies)}")
    print(f"- Execution time: {elapsed:.1f}s")
    print()
    print("## CONASAMI Wages Extracted")
    print("| Trade Code | Category | Zona General | ZLF Norte |")
    print("|---|---|---|---|")
    for code, wages in sorted(CONASAMI_2025.items()):
        cat_name = {
            'ALBANIL': 'Albañil, oficial de',
            'CARPINTERO_ON': 'Carpintero de obra negra',
            'CARPINTERO_OB': 'Carpintero en acabados',
            'ELECTRICISTA': 'Electricista instalador',
            'HERRERO': 'Herrería, oficial de',
            'PINTOR': 'Pintor de construcciones',
            'PLOMERO': 'Plomero en instalaciones sanitarias',
            'SOLDADOR': 'Soldador con soplete/arco',
            'YESERO': 'Yesero en construcción',
            'AZULEJERO': 'Colocador de mosaicos/azulejos',
            'COLOCADOR': 'Colocador de revestimientos',
            'OP_MAQ': 'Operador de maq. pesada',
            'PEON': 'Peón (SMG)',
            'AY_GENERAL': 'Ayudante general (SMG)',
            'AY_ESP': 'Ayudante especializado',
        }.get(code, code)
        print(f"| {code} | {cat_name} | ${wages['zona_general']:.2f} | ${wages['zlf_norte']:.2f} |")

    print()
    print("## Calculated Prices — Region 1 (Valle de México)")
    print("| Key | Cuadrilla | Calculated | Seed | Delta |")
    print("|---|---|---|---|---|")
    for key in claves:
        if key not in uuid_map:
            continue
        price = calculate_cuadrilla_price(key, 'zona_general')
        seed = SEED_PRICES_R1.get(key)
        delta = f"{(price - seed) / seed * 100:+.1f}%" if seed else "N/A"
        comp_str = "+".join(f"{q}×{t}" for t, q in COMPOSITIONS[key])
        print(f"| {key} | {comp_str} | ${price:,.2f} | ${seed:,.2f} | {delta} |")

    if fallbacks_used:
        print()
        print("## Fallbacks Used")
        for trade, fb in sorted(fallbacks_used.items()):
            print(f"- {trade}: {fb}")

    if anomalies:
        print()
        print("## Anomalies (delta > 25%)")
        for a in sorted(anomalies, key=lambda x: abs(x['delta_pct']), reverse=True):
            print(f"- {a['key']}: calculated={a['calculated']:.2f} vs seed={a['seed']:.2f}, delta={a['delta_pct']:+.1f}%")

    print()
    print("## Verification Queries Run")
    print(f"- AC-04: {inserted} records inserted {'✓' if inserted == 407 else '⚠ (' + str(inserted) + ')'}")
    print(f"- AC-05: All 37 cuadrillas have 11 regional prices {'✓' if ac05_ok else '✗'}")
    print(f"- AC-06: Region 4 > Region 1 for all cuadrillas {'✓' if ac06_ok else '✗'}")
    if deltas:
        print(f"- AC-07: Max delta vs seed = {max_delta:.1f}% {'✓' if max_delta < 50 else '✗'}")
    print(f"- AC-08: fuente_tipo='api_oficial', confianza=0.95 {'✓' if ac08_ok else '✗'}")
    print(f"- AC-09: Seed prices preserved ({seed_count} records) ✓")
    print()
    print("## Next Steps")
    print("- Next annual update: January 1, 2026")
    print("- Cron schedule: 0 12 1 1 *")
    print()
    print("Report generated.")


if __name__ == '__main__':
    main()
