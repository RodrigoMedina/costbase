const API_URL = process.env.COSTBASE_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.COSTBASE_API_TOKEN || '';

async function request(path: string, options?: { method?: string; body?: unknown }): Promise<unknown> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export async function listModules(): Promise<unknown> {
  return request('/modules');
}

export async function getModuleSchema(code: string): Promise<unknown> {
  return request(`/modules/${code}/schema`);
}

export async function calcularModulo(code: string, params: Record<string, unknown>, region_id: number): Promise<unknown> {
  return request(`/modules/${code}/calcular`, {
    method: 'POST',
    body: { params, region_id },
  });
}

export async function getPresupuesto(items: Array<{ code: string; params: Record<string, unknown>; cantidad: number }>, region_id: number): Promise<unknown> {
  return request('/presupuesto', {
    method: 'POST',
    body: { items, region_id },
  });
}

export async function searchConceptos(q: string, limit = 20, threshold = 0.5): Promise<unknown> {
  return request('/data/conceptos/search', {
    method: 'POST',
    body: { q, limit: String(limit), threshold: String(threshold) },
  });
}

export async function searchInsumos(q: string, limit = 20): Promise<unknown> {
  return request('/data/insumos/search', {
    method: 'POST',
    body: { q, limit: String(limit) },
  });
}

export async function getConcepto(id: string): Promise<unknown> {
  return request(`/data/conceptos/${id}`);
}

export async function getConceptoMatriz(id: string, region_id = 1): Promise<unknown> {
  return request(`/data/conceptos/${id}/matriz?region_id=${region_id}`);
}

export async function getInsumo(id: string): Promise<unknown> {
  return request(`/data/insumos/${id}`);
}

export async function getInsumoPrecios(id: string, region_id?: number): Promise<unknown> {
  const qs = region_id ? `?region_id=${region_id}` : '';
  return request(`/data/insumos/${id}/precios${qs}`);
}

export async function getPartidas(): Promise<unknown> {
  return request('/data/partidas?tree=true');
}

export async function getPartidaConceptos(id: string, page = 1, limit = 50): Promise<unknown> {
  return request(`/data/partidas/${id}/conceptos?page=${page}&limit=${limit}`);
}
