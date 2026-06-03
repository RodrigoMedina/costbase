import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as http from 'node:http';
import * as client from './client.js';

const server = new Server(
  { name: 'costbase-mcp', version: '1.0.0' },
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
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Código del módulo (ej. Z1, C1, M1)' },
        },
        required: ['code'],
      },
    },
    {
      name: 'calcular_modulo',
      description: 'Calcula el precio unitario de un módulo paramétrico con los parámetros dados y precios de una región específica',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Código del módulo' },
          params: { type: 'object', description: 'Parámetros del módulo (consulta get_module_schema para ver los requeridos)' },
          region_id: { type: 'number', description: 'ID de región (1=Valle de México, 2=Norte, 3=Noreste, etc)', default: 1 },
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
                code: { type: 'string', description: 'Código del módulo' },
                params: { type: 'object', description: 'Parámetros' },
                cantidad: { type: 'number', description: 'Cantidad de obra' },
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
      description: 'Busca conceptos (precios unitarios) usando búsqueda semántica por texto libre. Ideal para encontrar conceptos similares a una descripción',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Texto de búsqueda (ej. "zapata corrida de 60cm con f\'c=250")' },
          limit: { type: 'number', default: 20, description: 'Máximo de resultados' },
          threshold: { type: 'number', default: 0.5, description: 'Umbral de similitud (0-1)' },
        },
        required: ['q'],
      },
    },
    {
      name: 'search_insumos',
      description: 'Busca insumos (materiales, mano de obra, maquinaria) usando búsqueda semántica',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Texto de búsqueda' },
          limit: { type: 'number', default: 20 },
        },
        required: ['q'],
      },
    },
    {
      name: 'get_concepto',
      description: 'Obtiene el detalle completo de un concepto (precio unitario) por su ID',
      inputSchema: {
        type: 'object',
        properties: {
          concepto_id: { type: 'string', description: 'UUID del concepto' },
        },
        required: ['concepto_id'],
      },
    },
    {
      name: 'get_concepto_matriz',
      description: 'Obtiene la matriz de insumos de un concepto: desglose completo de materiales, mano de obra y maquinaria con cantidades y precios',
      inputSchema: {
        type: 'object',
        properties: {
          concepto_id: { type: 'string', description: 'UUID del concepto' },
          region_id: { type: 'number', default: 1, description: 'Región para precios' },
        },
        required: ['concepto_id'],
      },
    },
    {
      name: 'get_insumo',
      description: 'Obtiene el detalle de un insumo (material, mano de obra o maquinaria) por su ID',
      inputSchema: {
        type: 'object',
        properties: {
          insumo_id: { type: 'string', description: 'UUID del insumo' },
        },
        required: ['insumo_id'],
      },
    },
    {
      name: 'get_insumo_precios',
      description: 'Obtiene los precios de un insumo en todas las regiones o en una región específica',
      inputSchema: {
        type: 'object',
        properties: {
          insumo_id: { type: 'string', description: 'UUID del insumo' },
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
      description: 'Obtiene los conceptos (precios unitarios) que pertenecen a una partida/categoría específica',
      inputSchema: {
        type: 'object',
        properties: {
          partida_id: { type: 'string', description: 'UUID de la partida' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 },
        },
        required: ['partida_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_modules': {
        const data = await client.listModules();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_module_schema': {
        const { code } = args as { code: string };
        const data = await client.getModuleSchema(code);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'calcular_modulo': {
        const { code, params, region_id = 1 } = args as { code: string; params: Record<string, unknown>; region_id?: number };
        const data = await client.calcularModulo(code, params, region_id);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_presupuesto': {
        const { items, region_id = 1 } = args as { items: Array<{ code: string; params: Record<string, unknown>; cantidad: number }>; region_id?: number };
        const data = await client.getPresupuesto(items, region_id);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'search_conceptos': {
        const { q, limit = 20, threshold = 0.5 } = args as { q: string; limit?: number; threshold?: number };
        const data = await client.searchConceptos(q, limit, threshold);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'search_insumos': {
        const { q, limit = 20 } = args as { q: string; limit?: number };
        const data = await client.searchInsumos(q, limit);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_concepto': {
        const { concepto_id } = args as { concepto_id: string };
        const data = await client.getConcepto(concepto_id);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_concepto_matriz': {
        const { concepto_id, region_id = 1 } = args as { concepto_id: string; region_id?: number };
        const data = await client.getConceptoMatriz(concepto_id, region_id);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_insumo': {
        const { insumo_id } = args as { insumo_id: string };
        const data = await client.getInsumo(insumo_id);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_insumo_precios': {
        const { insumo_id, region_id } = args as { insumo_id: string; region_id?: number };
        const data = await client.getInsumoPrecios(insumo_id, region_id);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_partidas': {
        const data = await client.getPartidas();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'get_partida_conceptos': {
        const { partida_id, page = 1, limit = 50 } = args as { partida_id: string; page?: number; limit?: number };
        const data = await client.getPartidaConceptos(partida_id, page, limit);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transportType = process.argv.includes('--transport')
    ? process.argv[process.argv.indexOf('--transport') + 1]
    : 'stdio';

  if (transportType === 'sse') {
    const port = parseInt(process.env.MCP_PORT || '3002', 10);
    let transport: SSEServerTransport;

    const httpServer = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'GET' && url.pathname === '/sse') {
        transport = new SSEServerTransport('/messages', res);
        await server.connect(transport);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/messages') {
        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.writeHead(500).end('SSE connection not established');
        }
        return;
      }

      res.writeHead(404).end('Not found');
    });

    httpServer.listen(port, () => {
      process.stderr.write(`CostBase MCP server (SSE) en puerto ${port}\n`);
      process.stderr.write(`  Conectar a: http://localhost:${port}/sse\n`);
    });
  } else {
    const transport = new StdioServerTransport();
    process.stderr.write('CostBase MCP server (stdio) iniciado\n');
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error('Error fatal en MCP server:', err);
  process.exit(1);
});
