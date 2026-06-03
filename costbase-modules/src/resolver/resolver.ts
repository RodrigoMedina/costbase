import { Pool } from 'pg';
import { ResultadoModulo, ResultadoConPrecios } from '../types/module.types';
import INSUMO_METADATA, { getInsumoMeta } from './insumo-metadata';
import { getConversionFactor } from './unit-conversion';

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildQuery(meta: ReturnType<typeof getInsumoMeta>): string | null {
  if (!meta) return null;

  const conditions: string[] = [`tipo = '${escapeSqlLiteral(meta.tipo_db)}'`];

  if (meta.exact_field && meta.exact_value) {
    conditions.push(`${meta.exact_field} = '${escapeSqlLiteral(meta.exact_value)}'`);
  }

  if (meta.keywords) {
    for (const kw of meta.keywords) {
      conditions.push(`nombre ILIKE '%${escapeSqlLiteral(kw)}%'`);
    }
  }

  if (meta.exclude_keywords) {
    for (const kw of meta.exclude_keywords) {
      conditions.push(`nombre NOT ILIKE '%${escapeSqlLiteral(kw)}%'`);
    }
  }

  return `WHERE ${conditions.join(' AND ')} ORDER BY LENGTH(nombre) ASC LIMIT 1`;
}

export async function resolver(
  resultado: ResultadoModulo,
  region_id: number,
  pool: Pool
): Promise<ResultadoConPrecios> {
  const insumos_con_precio = [];
  const totales = { materiales: 0, mano_obra: 0, maquinaria: 0, costo_directo: 0 };

  for (const insumo of resultado.insumos) {
    const meta = getInsumoMeta(insumo.tipo);

    if (!meta) {
      insumos_con_precio.push({
        ...insumo,
        cantidad_total: 0,
        insumo_id: '',
        nombre_db: `[UNMAPPED] ${insumo.tipo}`,
        precio_unitario: 0,
        subtotal: 0,
        fuente_precio: 'unmapped',
        confianza: 0,
        unidad_db: null,
        conversion_aplicada: null,
      });
      console.warn(`RESOLVER: No metadata for tipo="${insumo.tipo}"`);
      continue;
    }

    const query = buildQuery(meta);
    if (!query) {
      console.warn(`RESOLVER: Could not build query for tipo="${insumo.tipo}"`);
      continue;
    }

    const insumo_row = await pool.query(
      `SELECT i.id, i.nombre, i.tipo, i.unidad FROM insumos i ${query}`
    );

    if (insumo_row.rows.length === 0) {
      insumos_con_precio.push({
        ...insumo,
        cantidad_total: 0,
        insumo_id: '',
        nombre_db: `[NOT FOUND] ${insumo.tipo}`,
        precio_unitario: 0,
        subtotal: 0,
        fuente_precio: 'not_found',
        confianza: 0,
        unidad_db: null,
        conversion_aplicada: null,
      });
      console.warn(`RESOLVER: No DB insumo for tipo="${insumo.tipo}"`);
      continue;
    }

    const { id: insumo_id, nombre: nombre_db, tipo: tipo_db, unidad: unidad_db } = insumo_row.rows[0];

    const precio_row = await pool.query(
      `SELECT precio, fuente_tipo, confianza
       FROM precios
       WHERE insumo_id = $1 AND region_id = $2
       ORDER BY fecha DESC LIMIT 1`,
      [insumo_id, region_id]
    );

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
        confianza = 0.5;
      }
    }

    const conversion_factor = getConversionFactor(unidad_db, meta.unidad_esperada);
    const precio_convertido = precio / conversion_factor;
    let conversion_aplicada: string | null = null;
    if (conversion_factor !== 1) {
      conversion_aplicada = `${unidad_db} → ${meta.unidad_esperada} (×${conversion_factor})`;
    }

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
      conversion_aplicada,
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
  };
}
