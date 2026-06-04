/**
 * Build bindings.json from metadata discovery + manual P0 overrides.
 */
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { getInsumoMeta, listRegisteredTipos } from '../src/resolver/insumo-metadata';
import type { TipoBinding } from '../src/resolver/tipo-binding.types';

config({ path: join(__dirname, '../.env') });

const MANUAL_OVERRIDES: Record<string, Partial<TipoBinding> & { insumo_id: string }> = {
  tabique_rojo_14cm: {
    insumo_id: 'cc6a382b-6216-4cc6-ae7c-bf2a976f4b02',
    price_divisor: 1000,
    expected_familia: 'tabique',
    source: 'human',
    notes: '6x13x26 tabique; drop keyword 14',
  },
  cimbra_castillos: {
    insumo_id: '4a057c5f-dd93-458d-8bd9-2c88fdac1570',
    expected_familia: 'cimbra',
    forbidden_nombre_contains: ['CASTILLO DE'],
    source: 'human',
    notes: 'Triplay losas M2 formwork only',
  },
  cimbra_columnas: {
    insumo_id: '4a057c5f-dd93-458d-8bd9-2c88fdac1570',
    expected_familia: 'cimbra',
    source: 'human',
  },
  tubo_cobre_34plg: {
    insumo_id: '8dd3b957-359c-461d-a7d0-a1c48a2f7dfd',
    pieza_longitud_m: 6.1,
    expected_familia: 'cobre',
    source: 'human',
  },
  cople_cobre: {
    insumo_id: '56efaa5b-c507-4a9c-8085-7df97693cb9c',
    expected_familia: 'cobre',
    source: 'human',
    notes: '3/4 cople URREA',
  },
  placa_acero: {
    insumo_id: 'cec97501-f238-4be6-9be2-b0f96635e6ec',
    expected_familia: 'acero',
    source: 'human',
    notes: '3/8 plate KG',
  },
  acarreo_material: {
    insumo_id: 'f70e1254-7ce9-4dee-93f3-03c9a355ec58',
    expected_familia: 'basico_obra',
    forbidden_nombre_contains: ['TIERRA', 'VEGETAL', 'JARDIN'],
    source: 'human',
    notes: 'Acarreo camión material excavación M3',
  },
  hule_neopreno: {
    insumo_id: 'c9f289aa-2981-427e-974d-77690c1eb3ae',
    expected_familia: 'general',
    source: 'human',
    notes: 'Empaque neopreno 3/8 M2',
  },
  sellador_silicon: {
    insumo_id: '9baceda5-e716-4576-9d7f-f87d2577ee4a',
    source: 'human',
    notes: 'Silicon cartucho',
  },
  tornilleria_aluminio: {
    insumo_id: '2fe7b726-7934-4172-bb04-dbbd5c444b8a',
    price_divisor: 1000,
    source: 'human',
    notes: 'Tornillo autorroscable MIL→PZA',
  },
  cinta_aislante: {
    insumo_id: 'c2e399f0-641d-413f-8b29-5c96e2fe1d49',
    source: 'human',
    notes: 'Cinta Scotch 23 (proxy)',
  },
  tubo_redondo_acero: {
    insumo_id: 'e5a87a7f-f072-4b5c-9f38-142a5d9f6a20',
    expected_familia: 'acero',
    forbidden_nombre_contains: ['CADWELD', 'MOLDE'],
    source: 'human',
    notes: 'PTR 1x1 proxy for tubo redondo KG',
  },
  platina_acero: {
    insumo_id: '0ac521cb-a630-4778-ba17-1fe577058455',
    expected_familia: 'acero',
    forbidden_nombre_contains: ['CADWELD'],
    source: 'human',
    notes: 'Solera 1/8x2.5 proxy platina KG',
  },
};

const SKIP_AUTO = new Set([
  'vidrio_4mm',
  'vidrio_6mm',
  'vidrio_laminado',
  'cimbra_castillos',
  'cimbra_columnas',
  'tabique_rojo_14cm',
  'tubo_cobre_34plg',
  'cople_cobre',
  'placa_acero',
]);

const FORBIDDEN_IDS = new Set([
  '35510c3d-1f2c-4bb8-aefc-105dfad0f404',
  '4b7e9ade-f998-4212-87ff-460fae9afe29',
  '66ad3ffe-1ae8-4b43-9f48-0a2a0e35a99e',
  '73c2037b-4819-420f-82b0-e14adef0d74a',
]);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function discover(tipo: string) {
  const meta = getInsumoMeta(tipo);
  if (!meta) return null;
  const conditions: string[] = [`tipo = $1`, 'activo = true'];
  const params: unknown[] = [meta.tipo_db];
  let idx = 2;
  if (meta.exact_field && meta.exact_value) {
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
  const res = await pool.query(
    `SELECT id, nombre, unidad FROM insumos WHERE ${conditions.join(' AND ')} ORDER BY LENGTH(nombre) ASC LIMIT 1`,
    params
  );
  return res.rows[0] ?? null;
}

async function main() {
  const out: Record<string, TipoBinding> = {};

  for (const tipo of listRegisteredTipos()) {
    if (MANUAL_OVERRIDES[tipo]) {
      out[tipo] = { source: 'human', ...MANUAL_OVERRIDES[tipo] } as TipoBinding;
      continue;
    }
    if (SKIP_AUTO.has(tipo)) continue;
    const row = await discover(tipo);
    if (!row || FORBIDDEN_IDS.has(row.id)) continue;
    out[tipo] = {
      insumo_id: row.id,
      source: 'auto_validated',
      notes: row.nombre.slice(0, 80),
    };
    if (row.unidad === 'MIL') out[tipo].price_divisor = 1000;
    if (row.unidad === 'TON') out[tipo].price_divisor = 1000;
    if (row.unidad === 'TRM' && tipo.includes('tubo')) out[tipo].pieza_longitud_m = 6.1;
    if (row.unidad === 'PZA' && tipo.includes('conduit')) out[tipo].pieza_longitud_m = 3.0;
  }

  const path = join(__dirname, '../src/resolver/bindings.json');
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Wrote ${Object.keys(out).length} bindings to ${path}`);
  await pool.end();
}

main();
