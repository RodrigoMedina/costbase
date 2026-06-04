/**
 * Upsert tipo_binding rows from src/resolver/bindings.json (run after 003_tipo_binding.sql).
 * Usage: bun run scripts/seed-tipo-binding.ts
 */
import { Pool } from 'pg';
import { config } from 'dotenv';
import bindings from '../src/resolver/bindings.json';
import type { TipoBinding } from '../src/resolver/tipo-binding.types';

config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const entries = Object.entries(bindings as Record<string, TipoBinding>);
  let ok = 0;
  for (const [tipo, b] of entries) {
    await pool.query(
      `INSERT INTO tipo_binding (tipo, insumo_id, price_divisor, pieza_longitud_m, expected_familia, forbidden_nombre_contains, source, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tipo) DO UPDATE SET
         insumo_id = EXCLUDED.insumo_id,
         price_divisor = EXCLUDED.price_divisor,
         pieza_longitud_m = EXCLUDED.pieza_longitud_m,
         expected_familia = EXCLUDED.expected_familia,
         forbidden_nombre_contains = EXCLUDED.forbidden_nombre_contains,
         source = EXCLUDED.source,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [
        tipo,
        b.insumo_id,
        b.price_divisor ?? null,
        b.pieza_longitud_m ?? null,
        b.expected_familia ?? null,
        b.forbidden_nombre_contains ?? null,
        b.source,
        b.notes ?? null,
      ]
    );
    ok++;
  }
  console.log(`Seeded ${ok} tipo_binding rows`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
