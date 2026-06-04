import { Pool } from 'pg';
import {
  ResultadoModulo,
  ResultadoConPrecios,
  ResolverWarning,
  InsumoConPrecio,
} from '../types/module.types';
import { getInsumoMeta, type InsumoMeta } from './insumo-metadata';
import { getTipoBinding } from './tipo-bindings.registry';
import {
  validateBindingTarget,
  computePriceDivisor,
} from './binding-validator';

const ALLOWED_EXACT_FIELDS = new Set(['clave_neodata']);

async function resolveByExactClave(
  pool: Pool,
  meta: InsumoMeta
): Promise<{ id: string; nombre: string; tipo: string; unidad: string } | null> {
  if (!meta.exact_field || !meta.exact_value || !ALLOWED_EXACT_FIELDS.has(meta.exact_field)) {
    return null;
  }
  const res = await pool.query(
    `SELECT id, nombre, tipo, unidad FROM insumos
     WHERE ${meta.exact_field} = $1 AND activo = true LIMIT 1`,
    [meta.exact_value]
  );
  return res.rows[0] ?? null;
}

async function resolveByBinding(
  pool: Pool,
  tipo: string,
  module_unidad: string,
  region_id: number
): Promise<{
  row: { id: string; nombre: string; tipo: string; unidad: string };
  bindingUsed: boolean;
  priceDivisor: number;
  conversionNote: string | null;
} | null> {
  const binding = getTipoBinding(tipo, region_id);
  if (!binding) return null;

  const res = await pool.query(
    `SELECT id, nombre, tipo, unidad FROM insumos WHERE id = $1 AND activo = true`,
    [binding.insumo_id]
  );
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const validation = validateBindingTarget(binding, row, module_unidad);
  if (!validation.ok) return null;

  const divisor = computePriceDivisor(binding, module_unidad, row.unidad);
  let conversionNote: string | null = null;
  if (divisor !== 1) {
    conversionNote = `binding: ${row.unidad} → ${module_unidad} (÷${divisor})`;
  }

  return { row, bindingUsed: true, priceDivisor: divisor, conversionNote };
}

function unitsCompatible(moduleUnit: string, dbUnit: string): boolean {
  const m = moduleUnit.toUpperCase();
  const d = dbUnit.toUpperCase();
  if (m === d) return true;
  if ((m === 'ML' || m === 'M') && (d === 'ML' || d === 'M')) return true;
  return false;
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
      pushWarning(warnings, 'unmapped', insumo.tipo, `No metadata for tipo "${insumo.tipo}"`);
      insumos_con_precio.push(
        emptyLine(insumo, {
          nombre_db: `[UNMAPPED] ${insumo.tipo}`,
          fuente_precio: 'unmapped',
          flags: ['unmapped'],
        })
      );
      continue;
    }

    const bound = await resolveByBinding(pool, insumo.tipo, insumo.unidad, region_id);
    const exact = bound ? null : await resolveByExactClave(pool, meta);

    const resolved = bound?.row ?? exact;
    const priceDivisor = bound?.priceDivisor ?? 1;
    const conversionNote = bound?.conversionNote ?? null;
    const flags: string[] = bound ? ['bound'] : exact ? ['exact_clave'] : [];

    if (!resolved) {
      pushWarning(
        warnings,
        'not_found',
        insumo.tipo,
        `No binding or exact clave for "${insumo.tipo}" (keyword fallback disabled)`
      );
      insumos_con_precio.push(
        emptyLine(insumo, {
          nombre_db: `[NOT FOUND] ${insumo.tipo}`,
          fuente_precio: 'not_found',
          flags: ['not_found'],
        })
      );
      continue;
    }

    const { id: insumo_id, nombre: nombre_db, tipo: tipo_db, unidad: unidad_db } = resolved;

    if (meta.expected_tipo_db && tipo_db !== meta.expected_tipo_db) {
      pushWarning(
        warnings,
        'category_mismatch',
        insumo.tipo,
        `"${nombre_db}" tipo ${tipo_db} ≠ expected ${meta.expected_tipo_db}`
      );
      flags.push('category_mismatch');
    }

    let precio_row = await pool.query(
      `SELECT precio, fuente_tipo, confianza FROM precios_actuales
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
        `SELECT precio, fuente_tipo, confianza FROM precios_actuales
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
      pushWarning(warnings, 'no_price', insumo.tipo, `No price for "${nombre_db}" region ${region_id}`);
      flags.push('no_price');
    }

    if (!unitsCompatible(insumo.unidad, unidad_db) && priceDivisor === 1 && !conversionNote) {
      pushWarning(
        warnings,
        'unit_unconverted',
        insumo.tipo,
        `Unit mismatch module ${insumo.unidad} vs DB ${unidad_db} without conversion`
      );
      flags.push('unit_unconverted');
    }

    const precio_convertido = precio > 0 ? precio / priceDivisor : 0;
    const cantidad_total = insumo.cantidad * (1 + (insumo.desperdicio ?? 0));
    const subtotal = cantidad_total * precio_convertido;

    insumos_con_precio.push({
      ...insumo,
      cantidad_total,
      insumo_id,
      nombre_db,
      precio_unitario: precio_convertido,
      subtotal,
      fuente_precio: bound ? 'tipo_binding' : fuente_precio,
      confianza,
      unidad_db,
      conversion_aplicada: conversionNote,
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
