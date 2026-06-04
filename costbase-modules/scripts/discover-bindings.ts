/**
 * One-off: discover insumo_id per tipo using metadata queries (authoring tool).
 * Run: npx ts-node scripts/discover-bindings.ts
 */
import { config } from 'dotenv';
import { Pool } from 'pg';
import { getInsumoMeta } from '../src/resolver/insumo-metadata';
import { listRegisteredTipos } from '../src/resolver/insumo-metadata';

config({ path: require('path').join(__dirname, '../.env') });

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
  const tipos = listRegisteredTipos().sort();
  for (const tipo of tipos) {
    const row = await discover(tipo);
    if (row) {
      console.log(`${tipo}\t${row.id}\t${row.unidad}\t${row.nombre.slice(0, 55)}`);
    } else {
      console.log(`${tipo}\tNOT_FOUND`);
    }
  }
  await pool.end();
}

main();
