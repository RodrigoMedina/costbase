import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

interface InsumoRow {
  id: string;
  clave_neodata: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  tipo: string;
  partida_id: string | null;
  familia: string | null;
  activo: boolean;
}

export function registerInsumoRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/data/insumos', async (req, reply) => {
    const { tipo, familia, q, page = '1', limit = '50', activo = 'true' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (tipo) { conditions.push(`i.tipo = $${idx++}`); params.push(tipo); }
    if (familia) { conditions.push(`i.familia = $${idx++}`); params.push(familia); }
    if (activo === 'true') { conditions.push(`i.activo = true`); }
    if (q) { conditions.push(`i.nombre ILIKE $${idx++}`); params.push(`%${q}%`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM insumos i ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query<InsumoRow>(
      `SELECT i.id, i.clave_neodata, i.nombre, i.descripcion, i.unidad, i.tipo, i.partida_id, i.familia, i.activo
       FROM insumos i ${where} ORDER BY i.nombre ASC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    return { items: dataRes.rows, total, page: parseInt(page), limit: parseInt(limit) };
  });

  app.get('/data/insumos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await pool.query<InsumoRow>(
      `SELECT id, clave_neodata, nombre, descripcion, unidad, tipo, partida_id, familia, activo
       FROM insumos WHERE id = $1`, [id]
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Insumo not found' });
    return res.rows[0];
  });

  app.get('/data/insumos/:id/precios', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { region_id } = req.query as { region_id?: string };

    let query = `
      SELECT pa.region_id, r.nombre as region_nombre, pa.precio, pa.moneda, pa.fuente_tipo, pa.confianza, pa.fecha
      FROM precios_actuales pa
      JOIN regiones r ON r.id = pa.region_id
      WHERE pa.insumo_id = $1`;
    const params: any[] = [id];

    if (region_id) { query += ` AND pa.region_id = $2`; params.push(parseInt(region_id)); }

    query += ` ORDER BY pa.region_id ASC`;
    const res = await pool.query(query, params);
    return { insumo_id: id, precios: res.rows };
  });
}
