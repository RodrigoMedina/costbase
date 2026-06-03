# CostBase MX — Phase 3: Parametric Modules Engine
## TypeScript Implementation PRD

**Executed by:** AI Agent with DB access + file system  
**Language:** TypeScript (Node.js + Fastify)  
**DB:** PostgreSQL (Neon) — already populated from Phase 1 & 2  
**Version:** 1.0 — June 2025  
**Modules to implement:** 100 (across 22 categories)  

---

## Table of Contents

1. [Context & What We Have](#1-context--what-we-have)
2. [Architecture](#2-architecture)
3. [TypeScript Interfaces (The Contract)](#3-typescript-interfaces-the-contract)
4. [Insumo Type Taxonomy](#4-insumo-type-taxonomy)
5. [The Resolver](#5-the-resolver)
6. [Module Implementations](#6-module-implementations)
7. [API Layer (Fastify)](#7-api-layer-fastify)
8. [Validation Against DB Conceptos](#8-validation-against-db-conceptos)
9. [Project Structure](#9-project-structure)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Execution Order](#11-execution-order)

---

## 1. Context & What We Have

### 1.1 What Exists in the DB

| Asset | Count | Table | Status |
|-------|-------|-------|--------|
| Insumos catalog | 18,000 | `insumos` | ✅ With prices |
| Prices (11 regions) | ~75,000 | `precios` | ✅ |
| Conceptos (unit prices) | 10,263 | `conceptos` | ✅ |
| Concepto matrices | 105,000 | `matrices` | ✅ Full insumo breakdown |
| Module catalog (names only) | 229 | `intelimats_catalog` | ✅ Names, ❌ No formulas |
| Partidas tree | ~400 | `partidas` | ✅ |

### 1.2 What We Are Building

**Parametric modules** are TypeScript functions that:
1. Accept user-defined parameters (dimensions, specs)
2. Apply engineering formulas (NTC-CDMX, ACI 318, CMIC) to compute insumo quantities
3. Return quantities tagged with abstract insumo types
4. A **Resolver** maps those types → real DB records → prices

The 10,263 conceptos in the DB are **validation references**, not the output source. When a module calculates a zapata corrida with specific dimensions, the result should be close (±10%) to the equivalent fixed concepto already in the DB.

### 1.3 How Neodata Did It (Inferred)

Neodata's Intelimats were compiled application code — not SQL. Their pre-defined conceptos (e.g., "Zapata corrida 60cm × 12cm f'c=250") are frozen outputs of those formulas run with standard parameters. We reverse-engineer the formulas from engineering first principles, then validate against Neodata's frozen outputs.

---

## 2. Architecture

```
USER INPUT
  { module: 'Z1', params: { ancho: 1.0, altura: 0.8, fc: 250 }, region_id: 3 }
  ↓
MODULE ENGINE (TypeScript pure function)
  Applies engineering formulas → produces abstract insumo list
  { tipo: 'concreto_fc250', cantidad: 0.144, unidad: 'M3' }
  { tipo: 'acero_no3',      cantidad: 9.94,  unidad: 'KG' }
  { tipo: 'cimbra_zapatas', cantidad: 1.20,  unidad: 'M2' }
  ↓
RESOLVER (TypeScript + DB query)
  Maps each tipo → insumo_id in PostgreSQL → precio for region_id
  concreto_fc250 → uuid-xxx → $2,940/M3 (Region 3)
  acero_no3      → uuid-yyy → $28.50/KG  (Region 3)
  cimbra_zapatas → uuid-zzz → $258/M2    (Region 3)
  ↓
OUTPUT
  {
    module: 'Z1',
    params: { ancho: 1.0, altura: 0.8, fc: 250 },
    region_id: 3,
    insumos: [
      { tipo, nombre_db, cantidad, unidad, precio_unitario, subtotal }
    ],
    totales: { materiales, mano_obra, maquinaria, costo_directo },
    validation: { concepto_ref, delta_pct, status }
  }
```

---

## 3. TypeScript Interfaces (The Contract)

All 100 modules implement these interfaces. Do not deviate.

```typescript
// src/types/module.types.ts

export type InsumoTipo = string; // from taxonomy in Section 4

export interface ParametroDefinicion {
  label: string;
  tipo: 'number' | 'select' | 'boolean';
  unidad?: string;
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: Array<{ value: number | string; label: string }>;
}

export interface InsumoRequerido {
  tipo: InsumoTipo;           // abstract type — Resolver maps this to DB
  cantidad: number;           // calculated quantity
  unidad: string;             // M3, KG, M2, ML, PZA, JOR, HR
  desperdicio?: number;       // waste factor e.g. 0.05 = 5%
  cantidad_total?: number;    // cantidad × (1 + desperdicio) — computed by engine
  descripcion?: string;       // human-readable note about this line
}

export interface ResultadoModulo {
  module_code: string;        // e.g. 'Z1'
  module_name: string;        // e.g. 'ZAPATA CORRIDA 2 ESCARPIOS'
  categoria: string;          // e.g. 'CIMENTACION ZAPATAS'
  params_used: Record<string, number | string | boolean>;
  unidad_modulo: string;      // the unit this module prices per (ML, M2, PZA, etc.)
  insumos: InsumoRequerido[];
  fuentes_norma: string[];    // e.g. ['NTC-CDMX Cimentaciones §4.3', 'ACI 318-19']
}

export interface ModuloDefinicion<P extends Record<string, unknown>> {
  code: string;
  name: string;
  categoria: string;
  unidad: string;
  params: Record<keyof P, ParametroDefinicion>;
  calcular: (params: P) => ResultadoModulo;
}

// After Resolver runs — this is the final output with prices
export interface ResultadoConPrecios extends ResultadoModulo {
  region_id: number;
  insumos_con_precio: Array<InsumoRequerido & {
    insumo_id: string;
    nombre_db: string;
    precio_unitario: number;
    subtotal: number;
    fuente_precio: string;
    confianza: number;
  }>;
  totales: {
    materiales: number;
    mano_obra: number;
    maquinaria: number;
    costo_directo: number;
  };
  validation?: {
    concepto_ref_clave?: string;
    concepto_ref_nombre?: string;
    concepto_ref_precio?: number;
    delta_pct?: number;          // % difference vs DB reference concepto
    status: 'ok' | 'warning' | 'no_ref';
  };
}
```

---

## 4. Insumo Type Taxonomy

This is the controlled vocabulary all modules use. The Resolver maps each type to DB records.

```typescript
// src/types/insumo-tipos.ts

export const INSUMO_TIPOS = {

  // ── CONCRETO ──────────────────────────────────────────────────────────
  CONCRETO_FC150:         'concreto_fc150',
  CONCRETO_FC200:         'concreto_fc200',
  CONCRETO_FC250:         'concreto_fc250',
  CONCRETO_FC300:         'concreto_fc300',
  CONCRETO_POBRE:         'concreto_pobre',      // f'c=100, plantillas
  MORTERO_1_4:            'mortero_1_4',
  MORTERO_1_5:            'mortero_1_5',
  MORTERO_1_6:            'mortero_1_6',

  // ── ACERO DE REFUERZO ─────────────────────────────────────────────────
  ACERO_NO3:              'acero_no3',           // 3/8" — 0.560 kg/ml
  ACERO_NO4:              'acero_no4',           // 1/2" — 0.994 kg/ml
  ACERO_NO5:              'acero_no5',           // 5/8" — 1.552 kg/ml
  ACERO_NO6:              'acero_no6',           // 3/4" — 2.235 kg/ml
  ACERO_NO8:              'acero_no8',           // 1"   — 3.973 kg/ml
  MALLA_66_1010:          'malla_electrosoldada_6x6_10_10',
  MALLA_44_88:            'malla_electrosoldada_4x4_8_8',
  ALAMBRE_RECOCIDO:       'alambre_recocido',

  // ── CIMBRA ────────────────────────────────────────────────────────────
  CIMBRA_ZAPATAS:         'cimbra_zapatas',
  CIMBRA_MUROS:           'cimbra_muros',
  CIMBRA_COLUMNAS:        'cimbra_columnas',
  CIMBRA_TRABES:          'cimbra_trabes',
  CIMBRA_LOSA:            'cimbra_losa',
  CIMBRA_ESCALERAS:       'cimbra_escaleras',

  // ── EXCAVACION / RELLENO ──────────────────────────────────────────────
  EXCAVACION_MANUAL:      'excavacion_manual',
  EXCAVACION_MAQUINA:     'excavacion_maquina',
  PLANTILLA:              'plantilla_concreto_pobre',
  RELLENO_COMPACTADO:     'relleno_compactado',
  ACARREO:                'acarreo_material',

  // ── MAMPOSTERIA ───────────────────────────────────────────────────────
  TABIQUE_14:             'tabique_rojo_14cm',
  TABIQUE_21:             'tabique_rojo_21cm',
  TABIQUE_28:             'tabique_rojo_28cm',
  BLOCK_15:               'block_concreto_15cm',
  BLOCK_20:               'block_concreto_20cm',
  PANEL_COVINTEC:         'panel_covintec',
  PANEL_TABLAROCA:        'panel_tablaroca',

  // ── ACABADOS ──────────────────────────────────────────────────────────
  YESO:                   'yeso_blanco',
  MEZCLA_APLANADO:        'mezcla_aplanado',     // cemento+arena para aplanados

  // ── ACERO ESTRUCTURAL ─────────────────────────────────────────────────
  PERFIL_IPR:             'perfil_ipr',          // I-beam (kg)
  PERFIL_PTR:             'perfil_ptr',          // square tube (kg)
  ANGULO_ESTRUCTURAL:     'angulo_estructural',  // angle iron (kg)
  PLACA_ACERO:            'placa_acero',         // steel plate (kg)
  SOLDADURA_ELECTRODO:    'soldadura_electrodo',
  PINTURA_ANTICORROSIVA:  'pintura_anticorrosiva',

  // ── ALUMINIO ──────────────────────────────────────────────────────────
  PERFIL_ALUMINIO:        'perfil_aluminio_kg',  // by weight (kg)
  VIDRIO_6MM:             'vidrio_6mm',
  VIDRIO_LAMINADO:        'vidrio_laminado',
  HULE_NEOPRENO:          'hule_neopreno',
  TORNILLERIA_ALUMINIO:   'tornilleria_aluminio',

  // ── MAMPARAS ──────────────────────────────────────────────────────────
  MAMPARA_SANILOCK:       'mampara_sanilock_m2', // by M2

  // ── HERRERIA ──────────────────────────────────────────────────────────
  TUBO_REDONDO:           'tubo_redondo_acero',
  TUBO_CUADRADO:          'tubo_cuadrado_acero',
  PLATINA_ACERO:          'platina_acero',
  PINTURA_ESMALTE:        'pintura_esmalte',

  // ── PLOMERIA ──────────────────────────────────────────────────────────
  TUBO_COBRE_12:          'tubo_cobre_12plg',
  TUBO_COBRE_34:          'tubo_cobre_34plg',
  TUBO_PVC_34:            'tubo_pvc_34plg',
  TUBO_PVC_1:             'tubo_pvc_1plg',
  COPLE_COBRE:            'cople_cobre',
  VALVULA_GLOBO:          'valvula_globo',
  TINACO:                 'tinaco_rotoplas',

  // ── ELECTRICIDAD ──────────────────────────────────────────────────────
  CABLE_THW_12:           'cable_thw_calibre_12',
  CABLE_THW_10:           'cable_thw_calibre_10',
  CABLE_THW_8:            'cable_thw_calibre_8',
  CONDUIT_EMT_34:         'conduit_emt_34plg',
  CONDUIT_PVC_34:         'conduit_pvc_34plg',
  CAJA_REGISTRO:          'caja_registro_elect',
  CONDULET:               'condulet_elect',
  CINTA_AISLANTE:         'cinta_aislante',

  // ── MANO DE OBRA (claves de cuadrilla en DB) ──────────────────────────
  MO_ALBANIL_PEON:        '1A1P',               // Cuadrilla albanil + peon
  MO_FIERRERO:            '1F1A',               // Cuadrilla fierrero + ay
  MO_HERRERO:             '1H1A',               // Cuadrilla herrero + ay
  MO_SOLDADOR:            '1S1E',               // Cuadrilla soldador + ay
  MO_CARPINTERO:          '1C1A',               // Carpintero + ay
  MO_PLOMERO:             '1P1E',               // Plomero + ay esp
  MO_ELECTRICISTA:        '1E1E',               // Electricista + ay esp
  MO_COLOCADOR:           '1CO1A',              // Colocador + ay
  MO_ALUMINIERO:          '1A1E',               // Aluminiero + ay esp
  MO_PEON:                '1P',                 // 1 peon solo
  MO_AYUDANTE:            '1A',                 // 1 ayudante
  MO_PINTOR:              '1P1A',               // Pintor + ay
  MO_YESERO:              '1Y1A',               // Yesero + ay

} as const;
```

---

## 5. The Resolver

The Resolver queries the DB to find the price for each abstract insumo type.

```typescript
// src/resolver/resolver.ts
import { Pool } from 'pg';
import { InsumoRequerido, ResultadoModulo, ResultadoConPrecios } from '../types/module.types';

// Maps tipo → SQL query fragment to find the right insumo in the DB
// The query must return: insumo_id, nombre, precio
const TIPO_QUERIES: Record<string, string> = {
  'concreto_fc250':
    `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%250%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'concreto_fc200':
    `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%200%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'concreto_fc150':
    `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%150%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'concreto_pobre':
    `WHERE tipo='material' AND nombre ILIKE '%concreto%pobre%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no3':
    `WHERE tipo='material' AND (nombre ILIKE '%acero%no.3%' OR nombre ILIKE '%varilla%3/8%' OR nombre ILIKE '%refuerzo%no 3%')
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no4':
    `WHERE tipo='material' AND (nombre ILIKE '%acero%no.4%' OR nombre ILIKE '%varilla%1/2%' OR nombre ILIKE '%refuerzo%no 4%')
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no5':
    `WHERE tipo='material' AND (nombre ILIKE '%acero%no.5%' OR nombre ILIKE '%varilla%5/8%' OR nombre ILIKE '%refuerzo%no 5%')
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no6':
    `WHERE tipo='material' AND (nombre ILIKE '%acero%no.6%' OR nombre ILIKE '%varilla%3/4%')
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'malla_electrosoldada_6x6_10_10':
    `WHERE tipo='material' AND nombre ILIKE '%malla%6x6%10/10%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'alambre_recocido':
    `WHERE tipo='material' AND nombre ILIKE '%alambre%recocido%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_zapatas':
    `WHERE tipo='material' AND nombre ILIKE '%cimbra%zapata%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_losa':
    `WHERE tipo='material' AND nombre ILIKE '%cimbra%losa%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_columnas':
    `WHERE tipo='material' AND nombre ILIKE '%cimbra%columna%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_muros':
    `WHERE tipo='material' AND nombre ILIKE '%cimbra%muro%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'excavacion_manual':
    `WHERE tipo='basico_obra' AND nombre ILIKE '%excavac%manual%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'excavacion_maquina':
    `WHERE tipo='basico_obra' AND nombre ILIKE '%excavac%maquin%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'plantilla_concreto_pobre':
    `WHERE tipo='basico_obra' AND nombre ILIKE '%plantilla%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'relleno_compactado':
    `WHERE tipo='basico_obra' AND nombre ILIKE '%relleno%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tabique_rojo_14cm':
    `WHERE tipo='material' AND nombre ILIKE '%tabique%' AND nombre ILIKE '%14%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tabique_rojo_21cm':
    `WHERE tipo='material' AND nombre ILIKE '%tabique%' AND nombre ILIKE '%21%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tabique_rojo_28cm':
    `WHERE tipo='material' AND nombre ILIKE '%tabique%' AND nombre ILIKE '%28%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'block_concreto_15cm':
    `WHERE tipo='material' AND nombre ILIKE '%block%' AND nombre ILIKE '%15%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'mortero_1_4':
    `WHERE (tipo='basico_obra' OR tipo='material') AND nombre ILIKE '%mortero%1:4%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'mortero_1_5':
    `WHERE (tipo='basico_obra' OR tipo='material') AND nombre ILIKE '%mortero%1:5%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'yeso_blanco':
    `WHERE tipo='material' AND nombre ILIKE '%yeso%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'perfil_ipr':
    `WHERE tipo='material' AND nombre ILIKE '%perfil%ipr%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'perfil_ptr':
    `WHERE tipo='material' AND nombre ILIKE '%ptr%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'angulo_estructural':
    `WHERE tipo='material' AND nombre ILIKE '%angulo%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'pintura_anticorrosiva':
    `WHERE tipo='material' AND nombre ILIKE '%pintura%anticorro%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'perfil_aluminio_kg':
    `WHERE tipo='material' AND (nombre ILIKE '%perfil%aluminio%' OR nombre ILIKE '%aluminio%valsa%' OR nombre ILIKE '%aluminio%cuprum%')
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'vidrio_6mm':
    `WHERE tipo='material' AND nombre ILIKE '%vidrio%6mm%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tubo_cobre_12plg':
    `WHERE tipo='material' AND nombre ILIKE '%tubo%cobre%1/2%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tubo_pvc_34plg':
    `WHERE tipo='material' AND nombre ILIKE '%tubo%pvc%3/4%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cable_thw_calibre_12':
    `WHERE tipo='material' AND nombre ILIKE '%cable%thw%' AND nombre ILIKE '%12%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'conduit_emt_34plg':
    `WHERE tipo='material' AND nombre ILIKE '%conduit%emt%'
     ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  // MO — use clave_neodata directly (exact match, more reliable)
  '1A1P':   `WHERE clave_neodata = '1A1P' AND tipo = 'mano_obra'`,
  '1F1A':   `WHERE clave_neodata = '1F1A' AND tipo = 'mano_obra'`,
  '1H1A':   `WHERE clave_neodata = '1H1A' AND tipo = 'mano_obra'`,
  '1S1E':   `WHERE clave_neodata = '1S1E' AND tipo = 'mano_obra'`,
  '1C1A':   `WHERE clave_neodata = '1C1A' AND tipo = 'mano_obra'`,
  '1P1E':   `WHERE clave_neodata = '1P1E' AND tipo = 'mano_obra'`,
  '1E1E':   `WHERE clave_neodata = '1E1E' AND tipo = 'mano_obra'`,
  '1CO1A':  `WHERE clave_neodata = '1CO1A' AND tipo = 'mano_obra'`,
  '1A1E':   `WHERE clave_neodata = '1A1E' AND tipo = 'mano_obra'`,
  '1P':     `WHERE clave_neodata = '1P' AND tipo = 'mano_obra'`,
  '1A':     `WHERE clave_neodata = '1A' AND tipo = 'mano_obra'`,
  '1P1A':   `WHERE clave_neodata = '1P1A' AND tipo = 'mano_obra'`,
  '1Y1A':   `WHERE clave_neodata = '1Y1A' AND tipo = 'mano_obra'`,
};

export async function resolver(
  resultado: ResultadoModulo,
  region_id: number,
  pool: Pool
): Promise<ResultadoConPrecios> {

  const insumos_con_precio = [];
  const totales = { materiales: 0, mano_obra: 0, maquinaria: 0, costo_directo: 0 };

  for (const insumo of resultado.insumos) {
    const query_fragment = TIPO_QUERIES[insumo.tipo];

    if (!query_fragment) {
      console.warn(`RESOLVER: No query defined for tipo="${insumo.tipo}" — skipping`);
      continue;
    }

    // Find the insumo in the catalog
    const insumo_row = await pool.query(
      `SELECT i.id, i.nombre, i.tipo FROM insumos i ${query_fragment}`,
      []
    );

    if (insumo_row.rows.length === 0) {
      console.warn(`RESOLVER: No insumo found in DB for tipo="${insumo.tipo}"`);
      continue;
    }

    const { id: insumo_id, nombre: nombre_db, tipo: tipo_db } = insumo_row.rows[0];

    // Get price for this region
    const precio_row = await pool.query(
      `SELECT precio, fuente_tipo, confianza
       FROM precios
       WHERE insumo_id = $1 AND region_id = $2
       ORDER BY fecha DESC LIMIT 1`,
      [insumo_id, region_id]
    );

    // Fallback to Region 1 if no price for this region
    let precio = 0, fuente_precio = 'not_found', confianza = 0;
    if (precio_row.rows.length > 0) {
      precio = parseFloat(precio_row.rows[0].precio);
      fuente_precio = precio_row.rows[0].fuente_tipo;
      confianza = parseFloat(precio_row.rows[0].confianza);
    } else {
      const fallback = await pool.query(
        `SELECT precio FROM precios WHERE insumo_id = $1 AND region_id = 1
         ORDER BY fecha DESC LIMIT 1`,
        [insumo_id]
      );
      if (fallback.rows.length > 0) {
        precio = parseFloat(fallback.rows[0].precio);
        fuente_precio = 'neodata_seed_r1_fallback';
        confianza = 0.50;
      }
    }

    const cantidad_total = insumo.cantidad * (1 + (insumo.desperdicio ?? 0));
    const subtotal = cantidad_total * precio;

    insumos_con_precio.push({
      ...insumo,
      cantidad_total,
      insumo_id,
      nombre_db,
      precio_unitario: precio,
      subtotal,
      fuente_precio,
      confianza,
    });

    // Accumulate totals by type
    if (tipo_db === 'mano_obra') totales.mano_obra += subtotal;
    else if (tipo_db === 'maquinaria') totales.maquinaria += subtotal;
    else totales.materiales += subtotal;
    totales.costo_directo += subtotal;
  }

  return {
    ...resultado,
    region_id,
    insumos_con_precio,
    totales,
  };
}
```

---

## 6. Module Implementations

### 6.1 Engineering Standards by Category

Before implementing any module, the agent must use these authoritative sources:

| Category | Primary Standard | Secondary |
|----------|-----------------|-----------|
| Cimentación concreto | NTC-CDMX Cimentaciones 2017 | ACI 318-19 |
| Estructura concreto | NTC-CDMX Concreto 2017 | ACI 318-19 |
| Estructura metálica | NTC-CDMX Acero 2017 | AISC 360 |
| Mampostería / castillos | NTC-CDMX Mampostería 2017 | CMIC rendimientos |
| Aluminio | Especificaciones CUPRUM/VALSA | AAMA standards |
| Electricidad | NOM-001-SEDE-2012 | CFE estándares |
| Plomería | NOM-001-CONAGUA | IAPMO |
| Aplanados / acabados | CMIC Manual de Rendimientos 2022 | CONAVI |

### 6.2 Weight per Linear Meter — Reference Constants

```typescript
// src/constants/materiales.constants.ts

// Rebar weights (kg/ml) per ASTM A615 / NMX-B-294
export const PESO_VARILLA: Record<string, number> = {
  'no2':  0.248,   // 1/4"
  'no3':  0.560,   // 3/8"
  'no4':  0.994,   // 1/2"
  'no5':  1.552,   // 5/8"
  'no6':  2.235,   // 3/4"
  'no8':  3.973,   // 1"
  'no10': 6.404,   // 1-1/4"
};

// Perimeter of stirrup for rectangular section (returns ml of rebar)
export function perimEstribo(b_cm: number, h_cm: number, rec_cm: number = 4): number {
  const b_net = (b_cm - 2 * rec_cm) / 100; // meters
  const h_net = (h_cm - 2 * rec_cm) / 100;
  return 2 * b_net + 2 * h_net + 0.25; // +0.25m for hooks
}

// Number of stirrups per linear meter of element
export function nEstribos(sep_cm: number): number {
  return Math.ceil(100 / sep_cm) + 1;
}

// Steel volume → kg given cross-sectional area
export function areaCircular_cm2(diam_mm: number): number {
  return Math.PI * Math.pow(diam_mm / 20, 2); // area in cm²
}
```

---

### 6.3 COMPLETE IMPLEMENTATIONS — Use These as Patterns

#### Z1 — ZAPATA CORRIDA 2 ESCARPIOS

> **What "escarpio" means:** The trapezoidal haunched sides of a strip footing. 2 escarpios = both sides are sloped (symmetric trapezoid). 1 escarpio = only one side is sloped. This changes the concrete volume formula.

```typescript
// src/modules/cimentacion/Z1-zapata-corrida-2-escarpios.ts

import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';
import { PESO_VARILLA, perimEstribo, nEstribos } from '../../constants/materiales.constants';

interface Z1Params {
  ancho_inferior_m: number;   // Bottom width of footing (m)
  ancho_superior_m: number;   // Top width (where wall sits, m)
  altura_base_m: number;      // Height of rectangular base (m)
  altura_escarpe_m: number;   // Height of each trapezoidal haunch (m)
  fc: 150 | 200 | 250 | 300; // Concrete strength
  long_varilla_long: string;  // Longitudinal rebar size: 'no3' | 'no4' | 'no5'
  n_varillas_long: number;    // Number of longitudinal bars (typically 2-4)
  long_varilla_trans: string; // Transverse rebar: 'no3' | 'no4'
  sep_estribos_cm: number;    // Stirrup spacing (cm)
}

// Formula notes (NTC-CDMX Cimentaciones §4.3):
// Concrete volume for 2-escarpio (trapezoid both sides) per linear meter:
//   V = ancho_superior × altura_base               ← rectangular base
//     + (ancho_inferior + ancho_superior)/2 × altura_escarpe × 2  ← both haunches
//   simplified: V = (ancho_inf + ancho_sup) / 2 × (altura_base + altura_escarpe*2) - ...
// Actually: V = ancho_superior × altura_base + 2 × triangle_area
//   triangle_area = ((ancho_inferior - ancho_superior)/2) × altura_escarpe / 2 × 2 sides
//   = (ancho_inferior - ancho_superior) × altura_escarpe / 2

export const Z1: ModuloDefinicion<Z1Params> = {
  code: 'Z1',
  name: 'ZAPATA CORRIDA 2 ESCARPIOS',
  categoria: 'CIMENTACION ZAPATAS',
  unidad: 'ML',   // priced per linear meter

  params: {
    ancho_inferior_m:  { label: 'Ancho inferior (m)',   tipo: 'number', default: 0.80, min: 0.40, max: 2.00 },
    ancho_superior_m:  { label: 'Ancho superior (m)',   tipo: 'number', default: 0.20, min: 0.10, max: 0.60 },
    altura_base_m:     { label: 'Altura base (m)',      tipo: 'number', default: 0.15, min: 0.10, max: 0.40 },
    altura_escarpe_m:  { label: 'Altura escarpe (m)',   tipo: 'number', default: 0.45, min: 0.20, max: 0.80 },
    fc:                { label: "f'c (kg/cm²)",         tipo: 'select', default: 250,
                         options: [{value:150,label:'150'},{value:200,label:'200'},{value:250,label:'250'},{value:300,label:'300'}] },
    long_varilla_long: { label: 'Varilla longitudinal', tipo: 'select', default: 'no4',
                         options: [{value:'no3',label:'No.3 (3/8")'},{value:'no4',label:'No.4 (1/2")'},{value:'no5',label:'No.5 (5/8")'}] },
    n_varillas_long:   { label: 'Número varillas long', tipo: 'number', default: 3, min: 2, max: 6 },
    long_varilla_trans:{ label: 'Varilla transversal',  tipo: 'select', default: 'no3',
                         options: [{value:'no3',label:'No.3 (3/8")'},{value:'no4',label:'No.4 (1/2")'}] },
    sep_estribos_cm:   { label: 'Sep. estribos (cm)',   tipo: 'number', default: 20,  min: 10, max: 30 },
  },

  calcular(p: Z1Params): ResultadoModulo {

    // ── EXCAVACION ──────────────────────────────────────────────────────
    // Extra 0.30m per side for working space (NTC §4.3.1)
    const ancho_exc = p.ancho_inferior_m + 0.60;
    const altura_total = p.altura_base_m + p.altura_escarpe_m;
    const vol_excavacion = ancho_exc * altura_total * 1.0; // per ML

    // ── PLANTILLA ───────────────────────────────────────────────────────
    const area_plantilla = p.ancho_inferior_m * 1.0; // M2 per ML

    // ── CONCRETO ────────────────────────────────────────────────────────
    // Trapezoidal section (2 escarpios = symmetric):
    // V = (ancho_superior × altura_base)              ← rectangular crown
    //   + (ancho_inferior + ancho_superior)/2 × altura_escarpe  ← trapezoid
    const vol_concreto =
      (p.ancho_superior_m * p.altura_base_m) +
      ((p.ancho_inferior_m + p.ancho_superior_m) / 2) * p.altura_escarpe_m;
    // per ML, so this is M3/ML

    // ── ACERO LONGITUDINAL ──────────────────────────────────────────────
    // kg/ML = n_bars × weight_per_meter × 1.05 (5% overlap/hooks)
    const kg_long = p.n_varillas_long * PESO_VARILLA[p.long_varilla_long] * 1.05;

    // ── ACERO TRANSVERSAL (estribos) ────────────────────────────────────
    // Stirrup perimeter = 2×(b_neto + h_neto) + hooks
    // b for stirrup = ancho_superior (top of footing)
    const b_estr_cm = p.ancho_superior_m * 100;
    const h_estr_cm = (p.altura_base_m + p.altura_escarpe_m) * 100;
    const perim_estribo = perimEstribo(b_estr_cm, h_estr_cm, 5); // 5cm cover
    const n_estr_pm = nEstribos(p.sep_estribos_cm); // stirrups per meter
    const kg_trans = PESO_VARILLA[p.long_varilla_trans] * perim_estribo * n_estr_pm;

    // Total steel
    const kg_acero_total = kg_long + kg_trans;

    // ── CIMBRA ──────────────────────────────────────────────────────────
    // Formwork on both sloped faces (lateral) per ML
    // Hypotenuse of each escarpment = sqrt(((ancho_inf-ancho_sup)/2)² + altura_esc²)
    const h_escarpe = p.altura_escarpe_m;
    const run_escarpe = (p.ancho_inferior_m - p.ancho_superior_m) / 2;
    const hipo = Math.sqrt(run_escarpe * run_escarpe + h_escarpe * h_escarpe);
    // Formwork = 2 sloped faces + 2 side faces of base
    const m2_cimbra = (2 * hipo + 2 * p.altura_base_m) * 1.0;

    // ── RELLENO ─────────────────────────────────────────────────────────
    // Backfill = excavated volume - concrete volume (approximate)
    const vol_relleno = Math.max(0, vol_excavacion - vol_concreto - area_plantilla * 0.05);

    // ── ACARREO ─────────────────────────────────────────────────────────
    const vol_acarreo = vol_excavacion * 1.25; // esponjamiento factor

    // ── MANO DE OBRA ────────────────────────────────────────────────────
    // CMIC rendimientos: cimentación corrida ≈ 0.30 JOR/ML albanil+peon
    // Plus 0.15 JOR/ML fierrero for steel prep
    const jor_albanil = 0.30;
    const jor_fierrero = 0.15;

    const concreto_tipo = `concreto_fc${p.fc}` as keyof typeof T;

    return {
      module_code: 'Z1',
      module_name: 'ZAPATA CORRIDA 2 ESCARPIOS',
      categoria: 'CIMENTACION ZAPATAS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: T.EXCAVACION_MANUAL,    cantidad: vol_excavacion, unidad: 'M3',  descripcion: 'Excavación para cimentación' },
        { tipo: T.PLANTILLA,            cantidad: area_plantilla, unidad: 'M2',  descripcion: 'Plantilla concreto pobre' },
        { tipo: concreto_tipo,          cantidad: vol_concreto,   unidad: 'M3',  desperdicio: 0.03 },
        { tipo: T.ACERO_NO4,            cantidad: kg_acero_total, unidad: 'KG',  desperdicio: 0.05 },
        { tipo: T.CIMBRA_ZAPATAS,       cantidad: m2_cimbra,      unidad: 'M2',  desperdicio: 0.05 },
        { tipo: T.RELLENO_COMPACTADO,   cantidad: vol_relleno,    unidad: 'M3' },
        { tipo: T.ACARREO,              cantidad: vol_acarreo,    unidad: 'M3',  descripcion: 'Acarreo material excavado' },
        { tipo: T.MO_ALBANIL_PEON,      cantidad: jor_albanil,    unidad: 'JOR', descripcion: 'Colocación concreto y cimbra' },
        { tipo: T.MO_FIERRERO,          cantidad: jor_fierrero,   unidad: 'JOR', descripcion: 'Habilitado acero' },
      ],
      fuentes_norma: [
        'NTC-CDMX Cimentaciones 2017 §4.3',
        'CMIC Manual de Rendimientos Cimentaciones 2022',
        'ACI 318-19 §13 Footings',
      ],
    };
  },
};
```

#### C1 — COLUMNA RECTANGULAR (Concreto)

```typescript
// src/modules/estructura/C1-columna-rectangular.ts

interface C1Params {
  base_cm: number;          // section b (cm)
  alto_cm: number;          // section h (cm)
  fc: 200 | 250 | 300;
  n_varillas: 4 | 6 | 8;   // longitudinal bars
  diam_long: string;        // 'no4' | 'no5' | 'no6'
  diam_estribo: string;     // 'no3' | 'no4'
  sep_estribos_cm: number;
}

// NTC-CDMX Concreto §6.2 — Columnas
// Cuantía mínima: 1% de área bruta, máxima 6%
// Estribo mínimo: ø3/8" (no3), separación ≤ 20cm en zona sísmica

export const C1 = {
  code: 'C1',
  name: 'COLUMNA RECTANGULAR',
  categoria: 'ESTRUCTURA COLUMNAS Y MUROS',
  unidad: 'ML',

  calcular(p: C1Params): ResultadoModulo {
    const area_sec = (p.base_cm * p.alto_cm) / 10000; // M²
    const vol_concreto = area_sec * 1.0; // M³/ML

    // Longitudinal steel
    const kg_long = p.n_varillas * PESO_VARILLA[p.diam_long] * 1.05;

    // Stirrups
    const perim = perimEstribo(p.base_cm, p.alto_cm, 4);
    const n_estr = nEstribos(p.sep_estribos_cm);
    const kg_estr = PESO_VARILLA[p.diam_estribo] * perim * n_estr;

    // Cimbra = perimeter of section × 1.05 M²/ML
    const m2_cimbra = (2 * p.base_cm + 2 * p.alto_cm) / 100 * 1.05;

    // MO: CMIC ≈ 0.45 JOR/ML albanil+peon, 0.20 JOR/ML fierrero
    return {
      module_code: 'C1',
      module_name: 'COLUMNA RECTANGULAR',
      categoria: 'ESTRUCTURA COLUMNAS Y MUROS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: `concreto_fc${p.fc}`, cantidad: vol_concreto,             unidad: 'M3', desperdicio: 0.03 },
        { tipo: T.ACERO_NO4,          cantidad: kg_long + kg_estr,        unidad: 'KG', desperdicio: 0.05 },
        { tipo: T.CIMBRA_COLUMNAS,    cantidad: m2_cimbra,                unidad: 'M2', desperdicio: 0.05 },
        { tipo: T.ALAMBRE_RECOCIDO,   cantidad: (kg_long + kg_estr)*0.02, unidad: 'KG' },
        { tipo: T.MO_ALBANIL_PEON,    cantidad: 0.45,                     unidad: 'JOR' },
        { tipo: T.MO_FIERRERO,        cantidad: 0.20,                     unidad: 'JOR' },
      ],
      fuentes_norma: ['NTC-CDMX Concreto 2017 §6.2', 'ACI 318-19 §10'],
    };
  },
};
```

#### M1 — MURO DE TABIQUE 14cm

```typescript
// src/modules/albanileria/M1-muro-tabique-14.ts

interface M1Params {
  altura_muro_m: number;    // wall height (affects scaffolding)
  con_castillos: boolean;   // include castillo estimation
  tipo_mortero: '1:4' | '1:5' | '1:6';
}

// NMX-C-006 ONNCCE tabique dimensions: 6.5×14×28 cm (h×e×l)
// Tabiques per M²: 1 / ((0.28 + junta)(0.065 + junta)) × 1.05
// Standard joint = 1.0 cm = 0.01 m
// Piezas/M² = 1/((0.28+0.01)×(0.065+0.01)) × 1.05 ≈ 48 pzas

export const M1 = {
  code: 'M1',
  name: 'MURO DE TABIQUE 14CM',
  categoria: 'ALBANILERIA MUROS',
  unidad: 'M2',

  calcular(p: M1Params): ResultadoModulo {
    const junta = 0.01; // 1cm standard joint
    const largo_tab = 0.28, alto_tab = 0.065; // tabique dimensions
    const piezas_m2 = (1 / ((largo_tab + junta) * (alto_tab + junta))) * 1.05;

    // Mortar volume: espesor_muro × factor_mortero (empirical CMIC)
    // 14cm muro = 0.14m × 0.030 M³ mortar per M² (joints only, hollow inside)
    const vol_mortero_m2 = 0.030;

    // Scaffolding factor: +15% labor if height > 3.5m
    const factor_andamio = p.altura_muro_m > 3.5 ? 1.15 : 1.0;

    // MO: CMIC ≈ 0.28 JOR/M² albanil+peon para muro 14cm
    const jor_base = 0.28 * factor_andamio;
    // Castillo contribution: if included, add ~0.05 JOR/M²
    const jor_castillo = p.con_castillos ? 0.05 : 0;

    const mortero_tipo = p.tipo_mortero === '1:4' ? T.MORTERO_1_4 :
                         p.tipo_mortero === '1:5' ? T.MORTERO_1_5 : T.MORTERO_1_6;

    return {
      module_code: 'M1',
      module_name: 'MURO DE TABIQUE 14CM',
      categoria: 'ALBANILERIA MUROS',
      params_used: { ...p },
      unidad_modulo: 'M2',
      insumos: [
        { tipo: T.TABIQUE_14,       cantidad: piezas_m2,          unidad: 'PZA', desperdicio: 0.03 },
        { tipo: mortero_tipo,       cantidad: vol_mortero_m2,      unidad: 'M3',  desperdicio: 0.05 },
        { tipo: T.MO_ALBANIL_PEON, cantidad: jor_base + jor_castillo, unidad: 'JOR' },
      ],
      fuentes_norma: [
        'NMX-C-006-ONNCCE Tabique',
        'CMIC Manual de Rendimientos Mampostería 2022',
        'NTC-CDMX Mampostería 2017 §3',
      ],
    };
  },
};
```

#### SEL08 — ALIMENTACION ELECTRICA (Salida)

> **"Cédula"** in electrical context = a circuit schedule. 1 cédula = 1 circuit run. "Cajas" = standard conduit boxes. "Condulet" = weatherproof conduit fittings for industrial/exposed runs.

```typescript
// src/modules/salidas-electricas/SEL08-alimentacion-1-cedula-cajas.ts

interface SEL08Params {
  long_ml: number;          // run length in meters
  calibre: '12' | '10' | '8'; // AWG wire gauge
  tipo_conduit: 'emt' | 'pvc'; // conduit type
}

// NOM-001-SEDE-2012 §310
// 1 cédula = 1 circuit (phase + neutral + ground)
// Cable: 3 conductors + 1 ground = 4× ML per run
// Conduit fill: 3 cables in 3/4" EMT (NOM-001 table C1)

export const SEL08 = {
  code: 'SEL08',
  name: 'ALIMENTACION ELEC 1 CEDULA CAJAS',
  categoria: 'SALIDAS ELECTRICAS',
  unidad: 'ML',

  calcular(p: SEL08Params): ResultadoModulo {
    // Cable: 3 conductors (L1 + N + T) × ML + 5% cuts/waste
    const metros_cable = p.long_ml * 3 * 1.05;
    // Conduit: 1× ML + 3% fittings
    const metros_conduit = p.long_ml * 1.03;
    // Boxes: 1 per 10 ML (rule of thumb for residential)
    const cajas = Math.ceil(p.long_ml / 10);

    const cable_tipo = p.calibre === '12' ? T.CABLE_THW_12 :
                       p.calibre === '10' ? T.CABLE_THW_10 : T.CABLE_THW_8;
    const conduit_tipo = p.tipo_conduit === 'emt' ? T.CONDUIT_EMT_34 : T.CONDUIT_PVC_34;

    // MO: CMIC ≈ 0.06 JOR/ML electricista+ay
    return {
      module_code: 'SEL08',
      module_name: 'ALIMENTACION ELEC 1 CEDULA CAJAS',
      categoria: 'SALIDAS ELECTRICAS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: cable_tipo,         cantidad: metros_cable,   unidad: 'ML', desperdicio: 0.05 },
        { tipo: conduit_tipo,       cantidad: metros_conduit, unidad: 'ML' },
        { tipo: T.CAJA_REGISTRO,    cantidad: cajas,          unidad: 'PZA' },
        { tipo: T.CINTA_AISLANTE,   cantidad: p.long_ml*0.02, unidad: 'PZA' },
        { tipo: T.MO_ELECTRICISTA,  cantidad: 0.06,           unidad: 'JOR' },
      ],
      fuentes_norma: ['NOM-001-SEDE-2012 §310, §362', 'CFE Especificaciones instalaciones'],
    };
  },
};
```

#### SHS17 — LINEA DE TOMA A CISTERNA

```typescript
// src/modules/hidrosanitarias/SHS17-linea-toma-cisterna.ts

interface SHS17Params {
  long_ml: number;
  diametro: '1/2' | '3/4' | '1';
  material: 'cobre' | 'pvc';
}

// NOM-001-CONAGUA domestic water supply
// Includes: pipe + fittings (elbows, tees) + supports

export const SHS17 = {
  code: 'SHS17',
  name: 'LINEA DE TOMA A CISTERNA',
  categoria: 'SALIDAS HIDROSANITARIAS',
  unidad: 'ML',

  calcular(p: SHS17Params): ResultadoModulo {
    const metro_tubo = p.long_ml * 1.05; // 5% cuts
    // Fittings: ~0.35 pieces per ML (elbows, couplings)
    const fittings = Math.ceil(p.long_ml * 0.35);

    const tubo_tipo = p.material === 'cobre'
      ? (p.diametro === '1/2' ? T.TUBO_COBRE_12 : T.TUBO_COBRE_34)
      : (p.diametro === '3/4' ? T.TUBO_PVC_34 : T.TUBO_PVC_1);

    return {
      module_code: 'SHS17',
      module_name: 'LINEA DE TOMA A CISTERNA',
      categoria: 'SALIDAS HIDROSANITARIAS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: tubo_tipo,       cantidad: metro_tubo, unidad: 'ML' },
        { tipo: T.COPLE_COBRE,   cantidad: fittings,   unidad: 'PZA' },
        { tipo: T.MO_PLOMERO,    cantidad: 0.05,       unidad: 'JOR' },
      ],
      fuentes_norma: ['NOM-001-CONAGUA §5', 'IAPMO UPC'],
    };
  },
};
```

---

### 6.4 Implementation Pattern for All Remaining Modules

The agent must implement the remaining modules following this exact pattern:

**For each module:**

1. **File location:** `src/modules/{categoria}/{CODE}-{nombre-kebab}.ts`
2. **Interface:** Define `{CODE}Params` with all parameters
3. **Formula source:** Use the standard from Section 6.1 for that category
4. **Engineering logic:**
   - All concrete: `vol = sección_transversal × longitud`
   - All rebar: `kg = n_barras × PESO_VARILLA[diam] × longitud × (1 + traslape)`
   - All stirrups: use `perimEstribo()` and `nEstribos()` from constants
   - All masonry: `piezas = 1/((largo+junta)×(alto+junta)) × desperdicio`
   - All formwork: `m2 = perimetro_seccion × longitud × (1 + desperdicio)`
5. **Labor (JOR):** Use CMIC 2022 rendimientos as reference

**Specific notes by category:**

**CIMENTACION CONTRATRABES (CT1-CT4):**
- "Ejes" = rows of longitudinal rebar. CT1=2 rows, CT2=3 rows, CT3=4 rows, CT4=5 rows
- Formula: kg_long = n_ejes × n_bars_per_eje × PESO_VARILLA × longitud
- Typically 2 bars per eje (top and bottom of each row)

**ESTRUCTURA TRABES T3/T4:**
- "Apoyos" = support zones along beam. T3=4 zones, T4=5 zones
- In continuous beams, more support zones = more stirrup density at supports
- Stirrup spacing at supports = sep/2 vs mid-span spacing
- Formula varies: calculate average stirrup density across all zones

**ALBAÑILERIA DALAS (D1-D4):**
- Dalas are horizontal tie beams in masonry construction
- D1 Desplante = foundation level, D2 Intermedia = mid-height, D3 Cerramiento = top
- All three have same formula as contratrabe but smaller sections (typically 15×20cm)
- D4 ARMEX = uses prefab Armex wire mesh instead of individual stirrups

**COLUMNAS C4, C5, C6 (stirrup configurations):**
- C4 (1 EST + ROMBO): Main rectangular stirrup + diamond-shaped cross-tie
  - kg_total = kg_estribo_rect + kg_rombo
  - Rombo perimeter ≈ diagonal × 2 + hooks = sqrt(b²+h²) × 2 + 0.25
- C5 (3 ESTRIBOS): 3 overlapping rectangular stirrups (for wide columns)
  - kg_total = 3 × perimEstribo(b/3, h) × n_stirrups
- C6 (1 EST + 2 EST): 1 perimeter stirrup + 2 inner stirrups (seismic)

**ESTRUCTURA METALICA (A1, C1, C2, C3):**
- All calculated in KG of steel
- C3 COLUMNA IPR: weight from standard IPR tables (IPR 100–300, typical 12-45 kg/ml)
- C1 COLUMNA 4 PLACAS: welded built-up section, sum of plate weights
- A1 ARMADURA: truss weight estimate = span × tributary_load × factor
- Add: pintura anticorrosiva (2 coats = 0.30 lt/M²), soldadura (0.05 kg/kg_acero)

**ALUMINIO (F01-F05, C01-V03, P01-P05, OV1-OV3):**
- All aluminum modules priced per PZA (piece)
- Aluminum weight: standard profiles = 1.5–4.5 kg/ML of frame
- Frame perimeter = 2×(ancho + alto) × 1.10 (corners + overlaps)
- Glass area = ancho × alto × 0.95 (frame deduction)
- Params for all: ancho_m, alto_m, tipo_vidrio, color_aluminio
- Use PERFIL_ALUMINIO_KG tipo for all aluminum profile material

**MAMPARAS SANILOCK (13 01–04):**
- Priced per M² of partition
- Sanilock is the brand but treat as generic bathroom partition system
- Params: ancho_m, alto_m, tipo (entre_muros | muro_izq | muro_der | sin_muros)
- The tipo affects hardware quantity (wall anchors, floor channels)
- Material: MAMPARA_SANILOCK_M2 tipo handles this as a unit price

**HERRERIA ESCALERAS (E1-E4):**
- All priced per TRAMO (flight) or per ML of stair run
- E1 MARINA: steep ship ladder, alternating steps, steel tube construction
- E3 RECTA: standard straight stair, guardrail included
- E4 CARACOL: spiral stair, price per level (3m height)
- Main material: TUBO_REDONDO or TUBO_CUADRADO (kg) + PLATINA_ACERO
- Add PINTURA_ESMALTE (2 coats, 0.20 lt/kg of steel)

---

## 7. API Layer (Fastify)

```typescript
// src/api/server.ts
import Fastify from 'fastify';
import { Pool } from 'pg';
import { resolver } from '../resolver/resolver';
import { ALL_MODULES } from '../modules/index';

const app = Fastify({ logger: true });
const pool = new Pool({ connectionString: process.env.POSTGRES_DSN });

// GET /modules — list all available modules with their param schemas
app.get('/modules', async () => {
  return Object.values(ALL_MODULES).map(m => ({
    code: m.code,
    name: m.name,
    categoria: m.categoria,
    unidad: m.unidad,
    params: m.params,
  }));
});

// POST /modules/:code/calcular — calculate a module with prices
app.post<{
  Params: { code: string };
  Body: { params: Record<string, unknown>; region_id: number };
}>('/modules/:code/calcular', async (req, reply) => {
  const { code } = req.params;
  const { params, region_id } = req.body;

  const modulo = ALL_MODULES[code];
  if (!modulo) return reply.status(404).send({ error: `Module ${code} not found` });

  const resultado = modulo.calcular(params as never);
  const con_precios = await resolver(resultado, region_id, pool);

  return con_precios;
});

// POST /presupuesto — calculate multiple modules at once
app.post<{
  Body: {
    region_id: number;
    items: Array<{ code: string; params: Record<string, unknown>; cantidad: number }>;
  };
}>('/presupuesto', async (req) => {
  const { region_id, items } = req.body;

  const lineas = await Promise.all(items.map(async item => {
    const modulo = ALL_MODULES[item.code];
    if (!modulo) return null;
    const resultado = modulo.calcular(item.params as never);
    const con_precios = await resolver(resultado, region_id, pool);
    return {
      ...con_precios,
      cantidad_obra: item.cantidad,
      importe: con_precios.totales.costo_directo * item.cantidad,
    };
  }));

  const total = lineas
    .filter(Boolean)
    .reduce((acc, l) => acc + (l?.importe ?? 0), 0);

  return { region_id, lineas: lineas.filter(Boolean), total_costo_directo: total };
});

// GET /modules/:code/schema — return param schema for a module
app.get<{ Params: { code: string } }>('/modules/:code/schema', async (req, reply) => {
  const modulo = ALL_MODULES[req.params.code];
  if (!modulo) return reply.status(404).send({ error: 'Not found' });
  return { code: modulo.code, name: modulo.name, params: modulo.params };
});

app.listen({ port: 3001, host: '0.0.0.0' });
```

```typescript
// src/modules/index.ts — export all 100 modules
import { Z1 } from './cimentacion/Z1-zapata-corrida-2-escarpios';
import { C1 as C1_Columna } from './estructura/C1-columna-rectangular';
import { M1 as M1_Muro } from './albanileria/M1-muro-tabique-14';
import { SEL08 } from './salidas-electricas/SEL08-alimentacion-1-cedula-cajas';
import { SHS17 } from './hidrosanitarias/SHS17-linea-toma-cisterna';
// ... import all 100 modules

export const ALL_MODULES: Record<string, ModuloDefinicion<never>> = {
  'Z1': Z1,
  'C1_COL': C1_Columna,
  'M1': M1_Muro,
  'SEL08': SEL08,
  'SHS17': SHS17,
  // ... all 100
};
```

---

## 8. Validation Against DB Conceptos

After implementing each module, validate against the closest existing concepto in the DB:

```typescript
// src/validation/validate-modules.ts

async function validateModule(
  module_code: string,
  test_params: Record<string, unknown>,
  region_id: number,
  pool: Pool
): Promise<void> {
  const modulo = ALL_MODULES[module_code];
  const resultado = await resolver(modulo.calcular(test_params as never), region_id, pool);

  // Find closest concepto in DB
  const concepto = await pool.query(`
    SELECT c.nombre, p.precio
    FROM conceptos c
    JOIN precios p ON p.insumo_id = c.id AND p.region_id = $1
    WHERE c.nombre ILIKE $2
    ORDER BY p.fecha DESC LIMIT 1
  `, [region_id, `%${module_code}%`]);

  if (concepto.rows.length > 0) {
    const ref_price = parseFloat(concepto.rows[0].precio);
    const calc_price = resultado.totales.costo_directo;
    const delta = Math.abs(calc_price - ref_price) / ref_price * 100;

    if (delta > 20) {
      console.warn(`⚠️  ${module_code}: delta ${delta.toFixed(1)}% vs DB ref (${ref_price})`);
    } else {
      console.log(`✓  ${module_code}: within ${delta.toFixed(1)}% of DB ref`);
    }
  }
}
```

**Validation thresholds:**
- Delta < 10%: ✅ Green — formula is well-calibrated
- Delta 10–20%: ⚠️ Yellow — acceptable, differences in rendimientos or waste factors
- Delta > 20%: 🔴 Red — review formula, likely a unit error or wrong constant

---

## 9. Project Structure

```
costbase-modules/
├── package.json
├── tsconfig.json
├── src/
│   ├── types/
│   │   ├── module.types.ts          ← Section 3
│   │   └── insumo-tipos.ts          ← Section 4
│   ├── constants/
│   │   └── materiales.constants.ts  ← Section 6.2
│   ├── resolver/
│   │   └── resolver.ts              ← Section 5
│   ├── modules/
│   │   ├── index.ts                 ← exports ALL_MODULES
│   │   ├── cimentacion/
│   │   │   ├── Z1-zapata-corrida-2-escarpios.ts
│   │   │   ├── Z2-zapata-corrida-1-escarpio.ts
│   │   │   ├── ... (all 22 cimentacion modules)
│   │   ├── estructura/
│   │   │   ├── C1-columna-rectangular.ts
│   │   │   ├── ... (all 13 estructura modules)
│   │   ├── albanileria/
│   │   │   ├── M1-muro-tabique-14.ts
│   │   │   ├── ... (all 25 albanileria modules)
│   │   ├── muros-plafones/
│   │   ├── herreria/
│   │   ├── aluminio/
│   │   ├── mamparas/
│   │   ├── salidas-electricas/
│   │   └── hidrosanitarias/
│   ├── api/
│   │   └── server.ts                ← Section 7
│   └── validation/
│       └── validate-modules.ts      ← Section 8
├── tests/
│   └── modules.test.ts
└── .env
```

```json
// package.json
{
  "name": "costbase-modules",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/api/server.js",
    "dev": "ts-node src/api/server.ts",
    "test": "jest",
    "validate": "ts-node src/validation/validate-modules.ts"
  },
  "dependencies": {
    "fastify": "^4.26.0",
    "pg": "^8.11.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/pg": "^8.11.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0"
  }
}
```

```
// .env
POSTGRES_DSN=postgresql://user:pass@host.neon.tech/costbase_mx?sslmode=require
PORT=3001
```

---

## 10. Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|--------------|
| AC-01 | All 100 modules implemented with correct TypeScript interfaces | `tsc` compiles with 0 errors |
| AC-02 | ALL_MODULES exports exactly 100 module codes | `Object.keys(ALL_MODULES).length === 100` |
| AC-03 | Every module has at least 3 insumos (no empty implementations) | Unit test per module |
| AC-04 | Every module has `fuentes_norma` with at least 1 source | Unit test |
| AC-05 | Resolver finds DB insumo for all tipos used across all modules | Run validation script, 0 "not found" warnings |
| AC-06 | API `/modules` returns 100 entries | GET /modules → array.length === 100 |
| AC-07 | API `/modules/Z1/calcular` returns correct structure | POST with test params → ResultadoConPrecios |
| AC-08 | API `/presupuesto` returns summed total | POST with 3 modules → total > 0 |
| AC-09 | Validation delta < 20% for all structural modules vs DB conceptos | Run validate-modules.ts, 0 red flags |
| AC-10 | MO cuadrilla claves match actual DB claves | Query confirms all 13 MO tipos resolve |

---

## 11. Execution Order

```
1.  Create project structure (mkdir -p src/{types,constants,resolver,modules,api,validation})
2.  Write package.json and tsconfig.json
3.  Write src/types/module.types.ts           (Section 3)
4.  Write src/types/insumo-tipos.ts           (Section 4)
5.  Write src/constants/materiales.constants.ts (Section 6.2)
6.  Write src/resolver/resolver.ts             (Section 5)
    → Test resolver: verify it finds 5 test insumos in DB before continuing
7.  Implement modules in this order:
    a. Cimentación (22 modules) — most complex, establish patterns here
    b. Estructura concreto (9 modules)
    c. Estructura metálica (4 modules)
    d. Albanilería (21 modules)
    e. Muros y plafones (4 modules)
    f. Herrería (4 modules)
    g. Aluminio (18 modules)
    h. Mamparas (4 modules)
    i. Eléctricas (5 modules)
    j. Hidrosanitarias (5 modules)
8.  Write src/modules/index.ts — export ALL_MODULES
9.  Write src/api/server.ts (Section 7)
10. Run: npx ts-node src/api/server.ts
11. Test: curl POST /modules/Z1/calcular with test params
12. Run: npx ts-node src/validation/validate-modules.ts
13. Fix any red flags (delta > 20%)
14. Run final acceptance criteria checks
15. Report results with all AC pass/fail
```

---

## Appendix: Module Count by Category

| Category | Modules | Codes |
|----------|---------|-------|
| Cimentación Pilas y Pilotes | 2 | P1, P5 |
| Cimentación Zapatas | 11 | Z1-Z11, Z21 |
| Cimentación Contratrabes | 4 | CT1-CT4 |
| Cimentación Varios | 5 | L2, M1-M4 |
| Estructura Columnas | 4 | C1, C4, C5, C6 |
| Estructura Trabes y Losas | 5 | L1, L2, L3, T3, T4 |
| Estructura Metálica | 4 | A1, C1-C3 |
| Albanilería Castillos | 5 | K1-K3, K10, K11 |
| Albanilería Muros | 4 | M1-M3, M6 |
| Albanilería Dalas | 4 | D1-D4 |
| Albanilería Registros | 3 | R1-R3 |
| Albanilería Aplanados | 5 | A1-A5 |
| Albanilería Varios | 4 | E1-E4 |
| Muros y Plafones | 4 | M1-M4 |
| Herrería | 4 | E1-E4 |
| Aluminio Fijos | 5 | F01-F05 |
| Aluminio Corredizos | 4 | C01, V01-V03 |
| Aluminio Batientes | 5 | P01-P05 |
| Aluminio Proyección | 4 | OV1-OV3, OV10 |
| Mamparas Sanilock | 4 | 13-01 to 13-04 |
| Salidas Eléctricas | 5 | SEL08-SEL12 |
| Salidas Hidrosanitarias | 5 | SHS17-SHS21 |
| **TOTAL** | **100** | |
