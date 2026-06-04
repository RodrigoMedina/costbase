import bindingsData from './bindings.json';
import type { TipoBinding } from './tipo-binding.types';

export const TIPO_BINDINGS: Record<string, TipoBinding> = bindingsData as Record<string, TipoBinding>;

/** Known-wrong insumo IDs (fiberglass, composite castillo, etc.) */
export const FORBIDDEN_INSUMO_IDS = new Set([
  '35510c3d-1f2c-4bb8-aefc-105dfad0f404',
  '4b7e9ade-f998-4212-87ff-460fae9afe29',
  '66ad3ffe-1ae8-4b43-9f48-0a2a0e35a99e',
  '73c2037b-4819-420f-82b0-e14adef0d74a',
]);

export function getTipoBinding(tipo: string, _region_id = 1): TipoBinding | undefined {
  const binding = TIPO_BINDINGS[tipo];
  if (!binding?.insumo_id) return undefined;
  if (FORBIDDEN_INSUMO_IDS.has(binding.insumo_id)) return undefined;
  return binding;
}

export function listBoundTipos(): string[] {
  return Object.keys(TIPO_BINDINGS);
}
