import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { createHash } from 'crypto';

interface TokenInfo {
  userId: string;
  keyId: string;
  name: string | null;
}

const tokenCache = new Map<string, { info: TokenInfo; expires: number }>();

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  if (req.url === '/') return;
  if (req.url.startsWith('/mcp/messages')) return;

  const q = req.query as Record<string, string>;
  if (q.api_key) {
    req.headers.authorization = `Bearer ${q.api_key}`;
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = auth.slice(7);
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    (req as any).tokenInfo = cached.info;
    return;
  }

  const hash = createHash('sha256').update(token).digest('base64url');
  const pool: Pool = (req as any).pool;

  const res = await pool.query(
    `SELECT id, reference_id, name FROM apikey
     WHERE key = $1 AND enabled = true
     AND (expires_at IS NULL OR expires_at > now())`,
    [hash]
  );

  if (res.rows.length === 0) {
    return reply.status(401).send({ error: 'Invalid or inactive API key' });
  }

  const row = res.rows[0];
  const info: TokenInfo = {
    userId: row.reference_id,
    keyId: row.id,
    name: row.name,
  };

  tokenCache.set(token, { info, expires: Date.now() + 60000 });
  (req as any).tokenInfo = info;
}
