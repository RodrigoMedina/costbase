import { Pool } from 'pg';
import {
  ResultadoModulo,
  ResultadoConPrecios,
  ResolverWarning,
  InsumoConPrecio,
} from '../types/module.types';
import INSUMO_METADATA, { getInsumoMeta, type InsumoMeta } from './insumo-metadata';
import { resolveUnitConversion } from './unit-conversion';

const ALLOWED_EXACT_FIELDS = new Set(['clave_neodata']);

interface CandidateRow {
  id: string;
  nombre: string;
  tipo: string;
  unidad: string;
  score: number;
}

function buildQuery(meta: InsumoMeta): { where: string; params: unknown[] } | null {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  conditions.push(`tipo = $${idx++}`);
  params.push(meta.tipo_db);

  if (meta.exact_field && meta.exact_value) {
    if (!ALLOWED_EXACT_FIELDS.has(meta.exact_field)) {
      throw new Error(`resolver.buildQuery: disallowed exact_field "${meta.exact_field}"`);
    }
    conditions.push(`${meta.exact_field} = $${idx++}`);
    params.push(meta.exact_value);
  }

  if (meta.keywords) {
    for (const kw of meta.keywords) {
      conditions.push(`nombre ILIKE $${idx++}`);
      params.push(`%${kw}%`);
    }
  }

  if (meta.exclude_keywords) {
    for (const kw of meta.exclude_keywords) {
      conditions.push(`nombre NOT ILIKE $${idx++}`);
      params.push(`%${kw}%`);
    }
  }

  const where = `WHERE ${conditions.join(' AND ')} AND activo = true`;
  return { where, params };
}

function scoreCandidate(
  row: { nombre: string; tipo: string; unidad: string },
  meta: InsumoMeta,
  module_unidad: string
): number {
  let score = 100;
  const nombre = row.nombre.toUpperCase();
  const modU = module_unidad.trim().toUpperCase();
  const dbU = row.unidad.trim().toUpperCase();
  const expU = meta.unidad_esperada.trim().toUpperCase();

  if (meta.expected_tipo_db && row.tipo !== meta.expected_tipo_db) {
    score -= 80;
  } else if (row.tipo !== meta.tipo_db) {
    score -= 40;
  }

  if (dbU === modU) score += 25;
  else if (dbU === expU) score += 10;
  else score -= 30;

  score -= Math.min(nombre.length / 20, 25);

  if (meta.prefer_keywords) {
    for (const kw of meta.prefer_keywords) {
      if (nombre.includes(kw.toUpperCase())) score += 15;
    }
  }

  return score;
}

async function resolveInsumoRow(
  pool: Pool,
  meta: InsumoMeta,
  module_unidad: string
): Promise<CandidateRow | null> {
  const built = buildQuery(meta);
  if (!built) return null;

  const res = await pool.query(
    `SELECT i.id, i.nombre, i.tipo, i.unidad FROM insumos i ${built.where} LIMIT 25`,
    built.params
  );

  if (res.rows.length === 0) return null;

  let best: CandidateRow | null = null;
  for (const row of res.rows) {
    const score = scoreCandidate(row, meta, module_unidad);
    if (!best || score > best.score) {
      best = { id: row.id, nombre: row.nombre, tipo: row.tipo, unidad: row.unidad, score };
    }
  }

  return best && best.score >= 0 ? best : null;
}

function pushWarning(warnings: ResolverWarning[], code: ResolverWarning['code'], tipo: string, message: string) {
  warnings.push({ code, insumo_tipo: tipo, message });
}

function emptyLine(insumo: ResultadoModulo['insumos'][0], overrides: Partial<InsumoConPrecio>): InsumoConPrecio {
  return {
    ...insumo,
    cantidad_total: 0,
    insumo_id: '',
    nombre_db: overrides.nombre_db ?? `[ERROR] ${insumo.tipo}`,
    precio_unitario: 0,
    subtotal: 0,
    fuente_precio: overrides.fuente_precio ?? 'error',
    confianza: 0,
    unidad_db: null,
    conversion_aplicada: null,
    flags: overrides.flags ?? [],
    ...overrides,
  };
}

export async function resolver(
  resultado: ResultadoModulo,
  region_id: number,
  pool: Pool
): Promise<ResultadoConPrecios> {
  const insumos_con_precio: InsumoConPrecio[] = [];
  const warnings: ResolverWarning[] = [];
  const totales = { materiales: 0, mano_obra: 0, maquinaria: 0, costo_directo: 0 };

  for (const insumo of resultado.insumos) {
    const meta = getInsumoMeta(insumo.tipo);

    if (!meta) {
      pushWarning(warnings, 'unmapped', insumo.tipo, `No metadata registry entry for tipo "${insumo.tipo}"`);
      insumos_con_precio.push(
        emptyLine(insumo, {
          nombre_db: `[UNMAPPED] ${insumo.tipo}`,
          fuente_precio: 'unmapped',
          flags: ['unmapped'],
        })
      );
      continue;
    }

    const candidate = await resolveInsumoRow(pool, meta, insumo.unidad);

    if (!candidate) {
      pushWarning(warnings, 'not_found', insumo.tipo, `No DB insumo matched keywords for "${insumo.tipo}"`);
      insumos_con_precio.push(
        emptyLine(insumo, {
          nombre_db: `[NOT FOUND] ${insumo.tipo}`,
          fuente_precio: 'not_found',
          flags: ['not_found'],
        })
      );
      continue;
    }

    const { id: insumo_id, nombre: nombre_db, tipo: tipo_db, unidad: unidad_db } = candidate;

    const flags: string[] = [];
    if (meta.expected_tipo_db && tipo_db !== meta.expected_tipo_db) {
      const msg = `Resolved "${nombre_db}" has tipo ${tipo_db}, expected ${meta.expected_tipo_db}`;
      pushWarning(warnings, 'category_mismatch', insumo.tipo, msg);
      flags.push('category_mismatch');
    }

    let precio_row = await pool.query(
      `SELECT precio, fuente_tipo, confianza
       FROM precios_actuales
       WHERE insumo_id = $1 AND region_id = $2`,
      [insumo_id, region_id]
    );

    let precio = 0;
    let fuente_precio = 'not_found';
    let confianza = 0;

    if (precio_row.rows.length > 0) {
      precio = parseFloat(precio_row.rows[0].precio);
      fuente_precio = precio_row.rows[0].fuente_tipo;
      confianza = parseFloat(precio_row.rows[0].confianza ?? 0);
    } else if (region_id !== 1) {
      precio_row = await pool.query(
        `SELECT precio, fuente_tipo, confianza
         FROM precios_actuales
         WHERE insumo_id = $1 AND region_id = 1`,
        [insumo_id]
      );
      if (precio_row.rows.length > 0) {
        precio = parseFloat(precio_row.rows[0].precio);
        fuente_precio = 'neodata_seed_r1_fallback';
        confianza = 0.5;
        flags.push('region_fallback');
      }
    }

    if (precio <= 0) {
      pushWarning(warnings, 'no_price', insumo.tipo, `No canonical price for insumo "${nombre_db}" in region ${region_id}`);
      flags.push('no_price');
    }

    const unitConv = resolveUnitConversion(insumo.unidad, meta, unidad_db);
    if (unitConv.warning) {
      pushWarning(
        warnings,
        'unit_unconverted',
        insumo.tipo,
        `Unit mismatch: module ${insumo.unidad}, metadata ${meta.unidad_esperada}, DB ${unidad_db} — no conversion applied`
      );
      flags.push('unit_unconverted');
    }

    const precio_convertido = precio > 0 ? precio / unitConv.factor : 0;
    const cantidad_total = insumo.cantidad * (1 + (insumo.desperdicio ?? 0));
    const subtotal = cantidad_total * precio_convertido;

    insumos_con_precio.push({
      ...insumo,
      cantidad_total,
      insumo_id,
      nombre_db,
      precio_unitario: precio_convertido,
      subtotal,
      fuente_precio,
      confianza,
      unidad_db,
      conversion_aplicada: unitConv.description,
      flags: flags.length > 0 ? flags : undefined,
    });

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
    warnings,
  };
}
