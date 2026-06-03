import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import { config } from 'dotenv';

import { resolver } from '../resolver/resolver';
import { ALL_MODULES } from '../modules/index';
import { authMiddleware } from './auth';
import { registerMcpRoutes } from './mcp-adapter';
import { registerInsumoRoutes } from './routes/insumos';
import { registerConceptoRoutes } from './routes/conceptos';
import { registerPartidaRoutes } from './routes/partidas';
import { registerPrecioRoutes } from './routes/precios';
import { registerSearchRoutes } from './routes/search';

config();

const app = Fastify({ logger: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.register(cors, { origin: true });

app.addHook('preHandler', async (req, reply) => {
  (req as any).pool = pool;
  return authMiddleware(req, reply);
});

app.get('/', async () => ({ name: 'CostBase API', version: '1.0.0' }));

app.get('/modules', async () => {
  return Object.values(ALL_MODULES).map(m => ({
    code: m.code,
    name: m.name,
    categoria: m.categoria,
    unidad: m.unidad,
    params: m.params,
  }));
});

app.post<{
  Params: { code: string };
  Body: { params: Record<string, unknown>; region_id: number };
}>('/modules/:code/calcular', async (req, reply) => {
  const { code } = req.params;
  const { params, region_id } = req.body;

  const modulo = ALL_MODULES[code];
  if (!modulo) return reply.status(404).send({ error: `Module ${code} not found` });

  const resultado = modulo.calcular(params as never);
  const con_precios = await resolver(resultado, region_id, pool);

  return con_precios;
});

app.post<{
  Body: {
    region_id: number;
    items: Array<{ code: string; params: Record<string, unknown>; cantidad: number }>;
  };
}>('/presupuesto', async (req) => {
  const { region_id, items } = req.body;

  const lineas = await Promise.all(items.map(async item => {
    const modulo = ALL_MODULES[item.code];
    if (!modulo) return null;
    const resultado = modulo.calcular(item.params as never);
    const con_precios = await resolver(resultado, region_id, pool);
    return {
      ...con_precios,
      cantidad_obra: item.cantidad,
      importe: con_precios.totales.costo_directo * item.cantidad,
    };
  }));

  const total = lineas
    .filter(Boolean)
    .reduce((acc, l) => acc + (l?.importe ?? 0), 0);

  return { region_id, lineas: lineas.filter(Boolean), total_costo_directo: total };
});

app.get<{ Params: { code: string } }>('/modules/:code/schema', async (req, reply) => {
  const modulo = ALL_MODULES[req.params.code];
  if (!modulo) return reply.status(404).send({ error: 'Not found' });
  return { code: modulo.code, name: modulo.name, params: modulo.params };
});

registerInsumoRoutes(app, pool);
registerConceptoRoutes(app, pool);
registerPartidaRoutes(app, pool);
registerPrecioRoutes(app, pool);
registerSearchRoutes(app, pool);

registerMcpRoutes(app, pool);

const port = parseInt(process.env.PORT || '3001', 10);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`CostBase API running on port ${port}`);
  console.log(`Modules: ${Object.keys(ALL_MODULES).length} | Data API: /data/*`);
});
