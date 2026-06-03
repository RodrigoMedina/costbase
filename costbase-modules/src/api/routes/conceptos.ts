import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

interface ConceptoRow {
  id: string;
  clave_neodata: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  partida_id: string | null;
  activo: boolean;
}

export function registerConceptoRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/data/conceptos', async (req, reply) => {
    const { partida_id, q, page = '1', limit = '50', activo = 'true' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (partida_id) { conditions.push(`c.partida_id = $${idx++}`); params.push(partida_id); }
    if (activo === 'true') { conditions.push(`c.activo = true`); }
    if (q) { conditions.push(`c.nombre ILIKE $${idx++}`); params.push(`%${q}%`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await pool.query(`SELECT COUNT(*) FROM conceptos c ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query<ConceptoRow>(
      `SELECT c.id, c.clave_neodata, c.nombre, c.descripcion, c.unidad, c.partida_id, c.activo
       FROM conceptos c ${where} ORDER BY c.nombre ASC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    return { items: dataRes.rows, total, page: parseInt(page), limit: parseInt(limit) };
  });

  app.get('/data/conceptos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await pool.query<ConceptoRow>(
      `SELECT id, clave_neodata, nombre, descripcion, unidad, partida_id, activo
       FROM conceptos WHERE id = $1`, [id]
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Concepto not found' });
    return res.rows[0];
  });

  app.get('/data/conceptos/:id/matriz', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { region_id = '1' } = req.query as { region_id?: string };

    const conceptoRes = await pool.query<ConceptoRow>(
      `SELECT id, clave_neodata, nombre, descripcion, unidad, partida_id, activo FROM conceptos WHERE id = $1`, [id]
    );
    if (conceptoRes.rows.length === 0) return reply.status(404).send({ error: 'Concepto not found' });

    const rowsRes = await pool.query(`
      SELECT m.id, m.insumo_id, i.clave_neodata as insumo_clave, i.nombre as insumo_nombre,
             i.unidad as insumo_unidad, i.tipo as insumo_tipo,
             m.cantidad, m.desperdicio, m.nivel, m.orden,
             pa.precio, pa.fuente_tipo, pa.confianza
      FROM matrices m
      JOIN insumos i ON i.id = m.insumo_id
      LEFT JOIN precios_actuales pa ON pa.insumo_id = m.insumo_id AND pa.region_id = $2
      WHERE m.concepto_id = $1
      ORDER BY m.nivel ASC, m.orden ASC
    `, [id, parseInt(region_id)]);

    return { concepto: conceptoRes.rows[0], rows: rowsRes.rows };
  });

  app.get('/data/conceptos/:id/precio', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { region_id = '1' } = req.query as { region_id?: string };

    const res = await pool.query(`
      SELECT pa.precio, pa.moneda, pa.fuente_tipo, pa.confianza, pa.fecha, pa.region_id
      FROM precios_actuales pa
      WHERE pa.insumo_id = $1 AND pa.region_id = $2
    `, [id, parseInt(region_id)]);

    if (res.rows.length === 0) return reply.status(404).send({ error: 'No price found for this concepto and region' });
    return { concepto_id: id, region_id: parseInt(region_id), ...res.rows[0] };
  });
}
