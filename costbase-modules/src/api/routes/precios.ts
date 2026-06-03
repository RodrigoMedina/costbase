import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

export function registerPrecioRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/data/precios', async (req, reply) => {
    const { insumo_id, region_id, fuente_tipo, page = '1', limit = '50' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (insumo_id) { conditions.push(`pa.insumo_id = $${idx++}`); params.push(insumo_id); }
    if (region_id) { conditions.push(`pa.region_id = $${idx++}`); params.push(parseInt(region_id)); }
    if (fuente_tipo) { conditions.push(`pa.fuente_tipo = $${idx++}`); params.push(fuente_tipo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM precios_actuales pa ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT pa.insumo_id, pa.region_id, r.nombre as region_nombre,
              pa.precio, pa.moneda, pa.fuente_tipo, pa.confianza, pa.fecha
       FROM precios_actuales pa
       JOIN regiones r ON r.id = pa.region_id
       ${where}
       ORDER BY pa.region_id ASC, pa.fecha DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    return { items: dataRes.rows, total, page: parseInt(page), limit: parseInt(limit) };
  });

  app.get('/data/regiones', async (_req) => {
    const res = await pool.query('SELECT id, nombre, estados FROM regiones ORDER BY id');
    return { items: res.rows };
  });
}
