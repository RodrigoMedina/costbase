import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import type { Server as McpServerType } from '@modelcontextprotocol/sdk/server/index.js';
import type { SSEServerTransport as SseTransportType } from '@modelcontextprotocol/sdk/server/sse.js';

let currentApiToken: string | undefined;

interface SessionEntry {
  transport: SseTransportType;
  token: string;
}

const sessions = new Map<string, SessionEntry>();

async function getMcpSdk() {
  const [{ Server }, { SSEServerTransport }, types] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/index.js') as Promise<{ Server: typeof McpServerType }>,
    import('@modelcontextprotocol/sdk/server/sse.js') as Promise<{ SSEServerTransport: typeof SseTransportType }>,
    import('@modelcontextprotocol/sdk/types.js'),
  ]);
  return { Server, SSEServerTransport, ...types };
}

async function createMcpServer(app: FastifyInstance, _pool: Pool) {
  const { Server, SSEServerTransport, ListToolsRequestSchema, CallToolRequestSchema } = await getMcpSdk();

  const server = new Server(
    { name: 'costbase', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_modules',
        description: 'Lista todos los módulos paramétricos disponibles con sus códigos, nombres, categorías y unidad',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_module_schema',
        description: 'Muestra los parámetros requeridos y sus valores por defecto para un módulo específico',
        inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Código del módulo (ej. Z1, C1, M1)' } }, required: ['code'] },
      },
      {
        name: 'calcular_modulo',
        description: 'Calcula el precio unitario de un módulo paramétrico con los parámetros dados y precios de una región específica',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Código del módulo' },
            params: { type: 'object', description: 'Parámetros del módulo' },
            region_id: { type: 'number', description: 'ID de región (1=Valle de México, 2=Norte, etc)', default: 1 },
          },
          required: ['code', 'params'],
        },
      },
      {
        name: 'get_presupuesto',
        description: 'Calcula un presupuesto completo con múltiples módulos y cantidades de obra',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string' }, params: { type: 'object' }, cantidad: { type: 'number' },
                },
                required: ['code', 'params', 'cantidad'],
              },
            },
            region_id: { type: 'number', default: 1 },
          },
          required: ['items'],
        },
      },
      {
        name: 'search_conceptos',
        description: 'Busca conceptos (precios unitarios) usando búsqueda semántica por texto libre',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Texto de búsqueda' },
            limit: { type: 'number', default: 20 },
            threshold: { type: 'number', default: 0.5 },
          },
          required: ['q'],
        },
      },
      {
        name: 'search_insumos',
        description: 'Busca insumos (materiales, mano de obra, maquinaria) usando búsqueda semántica',
        inputSchema: {
          type: 'object',
          properties: { q: { type: 'string' }, limit: { type: 'number', default: 20 } },
          required: ['q'],
        },
      },
      {
        name: 'get_concepto',
        description: 'Obtiene el detalle completo de un concepto (precio unitario) por su ID',
        inputSchema: {
          type: 'object',
          properties: { concepto_id: { type: 'string', description: 'UUID del concepto' } },
          required: ['concepto_id'],
        },
      },
      {
        name: 'get_concepto_matriz',
        description: 'Obtiene la matriz de insumos de un concepto con cantidades y precios',
        inputSchema: {
          type: 'object',
          properties: {
            concepto_id: { type: 'string' },
            region_id: { type: 'number', default: 1 },
          },
          required: ['concepto_id'],
        },
      },
      {
        name: 'get_insumo',
        description: 'Obtiene el detalle de un insumo (material, mano de obra o maquinaria) por su ID',
        inputSchema: {
          type: 'object',
          properties: { insumo_id: { type: 'string', description: 'UUID del insumo' } },
          required: ['insumo_id'],
        },
      },
      {
        name: 'get_insumo_precios',
        description: 'Obtiene los precios de un insumo en todas las regiones o en una región específica',
        inputSchema: {
          type: 'object',
          properties: {
            insumo_id: { type: 'string' },
            region_id: { type: 'number', description: 'Opcional: filtrar por región' },
          },
          required: ['insumo_id'],
        },
      },
      {
        name: 'get_partidas',
        description: 'Obtiene el árbol completo de categorías (partidas) del catálogo de conceptos',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_partida_conceptos',
        description: 'Obtiene los conceptos que pertenecen a una partida/categoría específica',
        inputSchema: {
          type: 'object',
          properties: {
            partida_id: { type: 'string' },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 50 },
          },
          required: ['partida_id'],
        },
      },
    ],
  }));

  async function api(method: string, url: string, body?: unknown, token?: string) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = token;
    const res: any = await app.inject({
      method: method as any,
      url,
      headers,
      payload: body ? JSON.stringify(body) : undefined,
    });
    if (res.statusCode >= 400) {
      const errText = (res.body as string).slice(0, 200);
      throw new Error(`API ${res.statusCode}: ${errText}`);
    }
    return JSON.parse(res.body as string);
  }

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const token = currentApiToken;

    try {
      let data: unknown;
      switch (name) {
        case 'list_modules':
          data = await api('GET', '/modules', undefined, token);
          break;
        case 'get_module_schema': {
          const { code } = args as { code: string };
          data = await api('GET', `/modules/${code}/schema`, undefined, token);
          break;
        }
        case 'calcular_modulo': {
          const { code, params, region_id = 1 } = args as any;
          data = await api('POST', `/modules/${code}/calcular`, { params, region_id }, token);
          break;
        }
        case 'get_presupuesto': {
          const { items, region_id = 1 } = args as any;
          data = await api('POST', '/presupuesto', { items, region_id }, token);
          break;
        }
        case 'search_conceptos': {
          const { q, limit = 20, threshold = 0.5 } = args as any;
          data = await api('POST', '/data/conceptos/search', { q, limit: String(limit), threshold: String(threshold) }, token);
          break;
        }
        case 'search_insumos': {
          const { q, limit = 20 } = args as any;
          data = await api('POST', '/data/insumos/search', { q, limit: String(limit) }, token);
          break;
        }
        case 'get_concepto': {
          const { concepto_id } = args as { concepto_id: string };
          data = await api('GET', `/data/conceptos/${concepto_id}`, undefined, token);
          break;
        }
        case 'get_concepto_matriz': {
          const { concepto_id, region_id = 1 } = args as any;
          data = await api('GET', `/data/conceptos/${concepto_id}/matriz?region_id=${region_id}`, undefined, token);
          break;
        }
        case 'get_insumo': {
          const { insumo_id } = args as { insumo_id: string };
          data = await api('GET', `/data/insumos/${insumo_id}`, undefined, token);
          break;
        }
        case 'get_insumo_precios': {
          const { insumo_id, region_id } = args as any;
          const qs = region_id ? `?region_id=${region_id}` : '';
          data = await api('GET', `/data/insumos/${insumo_id}/precios${qs}`, undefined, token);
          break;
        }
        case 'get_partidas':
          data = await api('GET', '/data/partidas?tree=true', undefined, token);
          break;
        case 'get_partida_conceptos': {
          const { partida_id, page = 1, limit = 50 } = args as any;
          data = await api('GET', `/data/partidas/${partida_id}/conceptos?page=${page}&limit=${limit}`, undefined, token);
          break;
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  return server;
}

export async function registerMcpRoutes(app: FastifyInstance, pool: Pool) {
  const mcpServer = await createMcpServer(app, pool);

  app.get('/mcp/sse', async (req, reply) => {
    const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
    reply.hijack();
    const transport = new SSEServerTransport('/mcp/messages', reply.raw);
    const sessionId = transport.sessionId;
    const authHeader = req.headers.authorization || '';
    sessions.set(sessionId, { transport, token: authHeader });
    reply.raw.on('close', () => sessions.delete(sessionId));
    await mcpServer.connect(transport);
  });

  app.post('/mcp/messages', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const sessionId = q.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
      return reply.status(401).send({ error: 'Invalid or expired session' });
    }
    const entry = sessions.get(sessionId)!;
    reply.hijack();
    currentApiToken = entry.token;
    try {
      await entry.transport.handlePostMessage(req.raw, reply.raw);
    } finally {
      currentApiToken = undefined;
    }
  });
}
