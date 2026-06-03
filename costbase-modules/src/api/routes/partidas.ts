import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

interface PartidaRow {
  id: string;
  clave_neodata: string;
  nombre: string;
  descripcion: string | null;
  padre_id: string | null;
  nivel: number;
  path: string;
  orden: number;
}

export function registerPartidaRoutes(app: FastifyInstance, pool: Pool) {
  app.get('/data/partidas', async (req, reply) => {
    const { tree } = req.query as { tree?: string };

    const res = await pool.query<PartidaRow>(
      `SELECT id, clave_neodata, nombre, descripcion, padre_id, nivel, path, orden
       FROM partidas ORDER BY path ASC`
    );

    if (tree === 'true') {
      return buildTree(res.rows);
    }

    return { items: res.rows, total: res.rows.length };
  });

  app.get('/data/partidas/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await pool.query<PartidaRow>(
      `SELECT id, clave_neodata, nombre, descripcion, padre_id, nivel, path, orden
       FROM partidas WHERE id = $1`, [id]
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Partida not found' });

    const children = await pool.query<PartidaRow>(
      `SELECT id, clave_neodata, nombre, descripcion, padre_id, nivel, path, orden
       FROM partidas WHERE padre_id = $1 ORDER BY orden ASC`, [id]
    );

    return { ...res.rows[0], children: children.rows };
  });

  app.get('/data/partidas/:id/conceptos', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { page = '1', limit = '50' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM conceptos WHERE partida_id = $1 AND activo = true`, [id]
    );
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await pool.query(
      `SELECT id, clave_neodata, nombre, descripcion, unidad, partida_id
       FROM conceptos WHERE partida_id = $1 AND activo = true
       ORDER BY nombre ASC LIMIT $2 OFFSET $3`,
      [id, parseInt(limit), offset]
    );

    return { items: dataRes.rows, total, page: parseInt(page), limit: parseInt(limit) };
  });
}

interface TreeNode extends PartidaRow {
  children: TreeNode[];
}

function buildTree(rows: PartidaRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const node of map.values()) {
    if (node.padre_id && map.has(node.padre_id)) {
      map.get(node.padre_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
