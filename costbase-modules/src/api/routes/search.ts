import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import OpenAI from 'openai';

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey: key });
}

const EMBEDDING_MODEL = 'text-embedding-3-small';

async function embed(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}

/** node-pg serializes number[] as Postgres array {...}; pgvector requires [n1,n2,...] */
function toPgVectorLiteral(vector: number[] | string): string {
  if (typeof vector === 'string') {
    const s = vector.trim();
    if (s.startsWith('[')) return s;
    if (s.startsWith('{')) {
      return `[${s.slice(1, -1)}]`;
    }
    return s;
  }
  return `[${vector.join(',')}]`;
}

export function registerSearchRoutes(app: FastifyInstance, pool: Pool) {
  app.post('/data/conceptos/search', async (req, reply) => {
    const { q, limit: limitStr = '20', threshold = '0.5' } = req.body as { q: string; limit?: string; threshold?: string };
    if (!q || q.trim().length === 0) return reply.status(400).send({ error: 'Query q is required' });

    let vector: number[];
    try {
      vector = await embed(q);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ success: false, error: `Embedding failed: ${message}` });
    }

    const limitNum = Math.min(parseInt(limitStr, 10) || 20, 100);
    const thresholdNum = parseFloat(threshold);
    const vectorLiteral = toPgVectorLiteral(vector);

    try {
      const res = await pool.query(
        `
      SELECT id, clave_neodata, nombre, descripcion, unidad, partida_id,
             1 - (embedding <=> $1::vector) AS similarity
      FROM conceptos
      WHERE activo = true
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) > $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `,
        [vectorLiteral, thresholdNum, limitNum]
      );

      return {
        query: q,
        model: EMBEDDING_MODEL,
        results: res.rows,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: `Search failed: ${message}` });
    }
  });

  app.post('/data/insumos/search', async (req, reply) => {
    const { q, limit: limitStr = '20', threshold = '0.5' } = req.body as { q: string; limit?: string; threshold?: string };
    if (!q || q.trim().length === 0) return reply.status(400).send({ error: 'Query q is required' });

    let vector: number[];
    try {
      vector = await embed(q);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ success: false, error: `Embedding failed: ${message}` });
    }

    const limitNum = Math.min(parseInt(limitStr, 10) || 20, 100);
    const thresholdNum = parseFloat(threshold);
    const vectorLiteral = toPgVectorLiteral(vector);

    try {
      const res = await pool.query(
        `
      SELECT id, clave_neodata, nombre, descripcion, unidad, tipo, familia,
             1 - (embedding <=> $1::vector) AS similarity
      FROM insumos
      WHERE activo = true
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) > $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `,
        [vectorLiteral, thresholdNum, limitNum]
      );

      return {
        query: q,
        model: EMBEDDING_MODEL,
        results: res.rows,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: `Search failed: ${message}` });
    }
  });

  app.get('/data/conceptos/:id/similares', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { limit: limitStr = '10' } = req.query as Record<string, string>;

    try {
      const source = await pool.query(
        `SELECT id, nombre, embedding FROM conceptos WHERE id = $1 AND activo = true`,
        [id]
      );
      if (source.rows.length === 0) return reply.status(404).send({ error: 'Concepto not found' });
      if (!source.rows[0].embedding) {
        return reply.status(404).send({ error: 'Concepto has no embedding' });
      }

      const vectorLiteral = toPgVectorLiteral(source.rows[0].embedding);
      const limitNum = Math.min(parseInt(limitStr, 10) || 10, 50);

      const res = await pool.query(
        `
      SELECT id, clave_neodata, nombre, descripcion, unidad,
             1 - (embedding <=> $1::vector) AS similarity
      FROM conceptos
      WHERE id != $2 AND activo = true AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `,
        [vectorLiteral, id, limitNum]
      );

      return { source: { id: source.rows[0].id, nombre: source.rows[0].nombre }, similares: res.rows };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: `Similares failed: ${message}` });
    }
  });
}
