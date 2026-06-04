import { Pool } from 'pg';
import { config } from 'dotenv';
import { ALL_MODULES } from '../modules/index';
import { resolver } from '../resolver/resolver';
import { listRegisteredTipos } from '../resolver/insumo-metadata';
import { TIPO_BINDINGS, listBoundTipos } from '../resolver/tipo-bindings.registry';

const BAD_FLAGS = new Set([
  'not_found',
  'unmapped',
  'category_mismatch',
  'unit_unconverted',
  'conversion_inverted',
  'no_price',
]);

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function getDefaultParams(mod: { params: Record<string, { default: unknown }> }): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(mod.params)) {
    params[key] = def.default;
  }
  return params;
}

interface ValidationResult {
  code: string;
  name: string;
  unidad: string;
  costo_directo: number;
  n_insumos: number;
  n_unresolved: number;
  n_warnings: number;
  total_materiales: number;
  total_mano_obra: number;
  delta_vs_ref?: number;
  ref_name?: string;
  status: 'ok' | 'warning' | 'no_ref' | 'error';
  errors: string[];
}

async function validate(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const region_id = 1;

  for (const [code, mod] of Object.entries(ALL_MODULES)) {
    const res: ValidationResult = {
      code,
      name: mod.name,
      unidad: mod.unidad,
      costo_directo: 0,
      n_insumos: 0,
      n_unresolved: 0,
      n_warnings: 0,
      total_materiales: 0,
      total_mano_obra: 0,
      status: 'ok',
      errors: [],
    };

    try {
      const params = getDefaultParams(mod);
      const resultado = mod.calcular(params);
      res.n_insumos = resultado.insumos.length;

      const con_precios = await resolver(resultado, region_id, pool);
      res.costo_directo = con_precios.totales.costo_directo;
      res.total_materiales = con_precios.totales.materiales;
      res.total_mano_obra = con_precios.totales.mano_obra;
      res.n_warnings = con_precios.warnings.length;

      const badLines = con_precios.insumos_con_precio.filter(
        (i) =>
          !i.insumo_id ||
          i.fuente_precio === 'not_found' ||
          i.fuente_precio === 'unmapped' ||
          (i.flags?.some((f) => BAD_FLAGS.has(f)) ?? false)
      );
      res.n_unresolved = badLines.length;

      if (con_precios.warnings.length > 0) {
        res.errors.push(
          con_precios.warnings
            .slice(0, 3)
            .map((w) => `${w.code}:${w.insumo_tipo}`)
            .join(', ')
        );
        res.status = 'warning';
      }

      if (badLines.length > 0) {
        res.errors.push(
          `Bad lines: ${badLines.map((i) => `${i.tipo}→${i.nombre_db}`).join('; ')}`
        );
        res.status = 'warning';
      }

      const ref = await pool.query(
        `
        SELECT c.clave_neodata, LEFT(c.nombre, 80) as nombre,
               (SELECT SUM(m.cantidad * (1 + COALESCE(m.desperdicio,0)/100) * pa.precio)
                FROM matrices m
                JOIN precios_actuales pa ON pa.insumo_id = m.insumo_id AND pa.region_id = $2
                WHERE m.concepto_id = c.id) as precio_calculado
        FROM conceptos c
        WHERE c.nombre ILIKE $1
          AND c.unidad = $3
        ORDER BY LENGTH(c.nombre) ASC
        LIMIT 1
      `,
        [`%${mod.name.replace(/^[A-Z]+\d+\s*/, '').substring(0, 30)}%`, region_id, mod.unidad]
      );

      if (ref.rows.length > 0) {
        const ref_row = ref.rows[0];
        res.ref_name = ref_row.nombre;
        if (ref_row.precio_calculado && parseFloat(ref_row.precio_calculado) > 0) {
          const ref_price = parseFloat(ref_row.precio_calculado);
          const delta = Math.abs(res.costo_directo - ref_price) / ref_price * 100;
          res.delta_vs_ref = Math.round(delta * 10) / 10;
          if (res.status === 'ok') {
            res.status = delta <= 20 ? 'ok' : 'warning';
          }
        } else {
          if (res.status === 'ok') res.status = 'no_ref';
        }
      } else if (res.status === 'ok') {
        res.status = 'no_ref';
      }
    } catch (err: unknown) {
      res.status = 'error';
      res.errors.push(err instanceof Error ? err.message : String(err));
    }

    results.push(res);
  }

  return results;
}

function printResults(results: ValidationResult[]) {
  console.log('\n' + '='.repeat(120));
  console.log('  VALIDATION RESULTS — MVP 10 Modules');
  console.log('='.repeat(120));
  console.log(
    '  ' +
      'Code'.padEnd(6) +
      'Status'.padEnd(12) +
      'Costo Dir.'.padEnd(14) +
      'Mat.'.padEnd(12) +
      'MO'.padEnd(12) +
      'Insumos'.padEnd(9) +
      'Bad'.padEnd(6) +
      'Warn'.padEnd(6) +
      'Delta%'.padEnd(8) +
      'Notes'
  );
  console.log('-'.repeat(120));

  for (const r of results) {
    const status_icon =
      r.status === 'ok' ? '✅' : r.status === 'warning' ? '⚠️' : r.status === 'no_ref' ? '➖' : '❌';
    const errors =
      r.errors.length > 0 ? r.errors.join('; ') : r.ref_name ? r.ref_name.substring(0, 50) : 'no ref';
    console.log(
      `  ${r.code.padEnd(5)}` +
        `${status_icon} ${r.status.padEnd(8)}` +
        `$${(r.costo_directo || 0).toFixed(0).padStart(9)} ` +
        `$${(r.total_materiales || 0).toFixed(0).padStart(8)} ` +
        `$${(r.total_mano_obra || 0).toFixed(0).padStart(8)} ` +
        `${r.n_insumos.toString().padStart(4)}   ` +
        `${r.n_unresolved.toString().padStart(4)}   ` +
        `${r.n_warnings.toString().padStart(4)}   ` +
        `${(r.delta_vs_ref !== undefined ? r.delta_vs_ref.toFixed(1) + '%' : 'N/A').padStart(6)} ` +
        `${errors.substring(0, 45)}`
    );
  }

  console.log('-'.repeat(120));
  const passed = results.filter((r) => r.status === 'ok').length;
  const warned = results.filter((r) => r.status === 'warning').length;
  const no_ref = results.filter((r) => r.status === 'no_ref').length;
  const failed = results.filter((r) => r.status === 'error').length;
  console.log(`  ✅ ${passed} passed | ⚠️ ${warned} warnings | ➖ ${no_ref} no reference | ❌ ${failed} errors`);
  console.log(`  Registered tipos in metadata: ${listRegisteredTipos().length}`);
  console.log(`  Tipo bindings loaded: ${listBoundTipos().length}`);

  const usedTipos = new Set<string>();
  for (const mod of Object.values(ALL_MODULES)) {
    const r = mod.calcular(getDefaultParams(mod));
    for (const ins of r.insumos) usedTipos.add(ins.tipo);
  }
  const missing = [...usedTipos].filter((t) => !TIPO_BINDINGS[t]).sort();
  const coverage = usedTipos.size
    ? Math.round(((usedTipos.size - missing.length) / usedTipos.size) * 1000) / 10
    : 0;
  console.log(`  Module tipo coverage: ${coverage}% (${usedTipos.size - missing.length}/${usedTipos.size})`);
  if (missing.length > 0) {
    console.log(`  Unbound tipos in MVP modules: ${missing.join(', ')}`);
  }
}

async function main() {
  console.log('Connecting to DB...');
  try {
    await pool.query('SELECT 1');
    console.log('DB connected OK');
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }

  const results = await validate();
  printResults(results);
  await pool.end();
}

main();
