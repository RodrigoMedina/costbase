import type { InsumoMeta } from './insumo-metadata';

const CONVERSION_FACTORS: Record<string, number> = {
  'MIL→PZA': 1000,
  'TON→KG': 1000,
  'L→M3': 0.001,
  'M3→L': 1000,
  'LT→L': 1,
  'L→LT': 1,
};

export interface UnitConversionResult {
  factor: number;
  applied: boolean;
  description: string | null;
  warning: boolean;
}

function normalizeUnit(u: string): string {
  const x = u.trim().toUpperCase();
  if (x === 'LT') return 'L';
  return x;
}

/**
 * Convert quantity from module unit to DB purchase unit for pricing.
 * factor = how many DB units per 1 module unit (multiply cantidad by factor to get DB qty,
 * or divide price: precio_convertido = precio / factor when price is per DB unit).
 */
export function resolveUnitConversion(
  module_unidad: string,
  meta: InsumoMeta,
  unidad_db: string
): UnitConversionResult {
  const mod = normalizeUnit(module_unidad);
  const expected = normalizeUnit(meta.unidad_esperada);
  const db = normalizeUnit(unidad_db);

  if (mod === db) {
    return { factor: 1, applied: true, description: null, warning: false };
  }

  if (expected === db && mod !== db) {
    const key = `${mod}→${db}`;
    const direct = CONVERSION_FACTORS[key];
    if (direct) {
      return {
        factor: direct,
        applied: true,
        description: `${mod} → ${db} (×${direct})`,
        warning: false,
      };
    }
    const reverse = CONVERSION_FACTORS[`${db}→${mod}`];
    if (reverse) {
      return {
        factor: 1 / reverse,
        applied: true,
        description: `${mod} → ${db} (÷${reverse})`,
        warning: false,
      };
    }
  }

  if (mod === 'ML' && db === 'PZA' && meta.pieza_longitud_m && meta.pieza_longitud_m > 0) {
    const factor = 1 / meta.pieza_longitud_m;
    return {
      factor,
      applied: true,
      description: `ML → PZA (pieza ${meta.pieza_longitud_m} m)`,
      warning: false,
    };
  }

  if (mod === 'PZA' && db === 'ML' && meta.pieza_longitud_m && meta.pieza_longitud_m > 0) {
    return {
      factor: meta.pieza_longitud_m,
      applied: true,
      description: `PZA → ML (pieza ${meta.pieza_longitud_m} m)`,
      warning: false,
    };
  }

  if (mod === 'ML' && db === 'M2' && meta.pieza_ancho_m && meta.pieza_ancho_m > 0) {
    const factor = 1 / meta.pieza_ancho_m;
    return {
      factor,
      applied: true,
      description: `ML → M2 (ancho ${meta.pieza_ancho_m} m)`,
      warning: false,
    };
  }

  if (mod === 'KG' && db === 'ML' && meta.kg_por_ml && meta.kg_por_ml > 0) {
    return {
      factor: meta.kg_por_ml,
      applied: true,
      description: `KG → ML (${meta.kg_por_ml} kg/ml)`,
      warning: false,
    };
  }

  if (mod === 'KG' && db === 'PZA' && meta.kg_por_pza && meta.kg_por_pza > 0) {
    return {
      factor: meta.kg_por_pza,
      applied: true,
      description: `KG → PZA (${meta.kg_por_pza} kg/pza)`,
      warning: false,
    };
  }

  if (db === expected) {
    return { factor: 1, applied: false, description: null, warning: mod !== expected };
  }

  return { factor: 1, applied: false, description: null, warning: true };
}

/** @deprecated use resolveUnitConversion */
export function getConversionFactor(db_unidad: string, expected_unidad: string): number {
  const mod = normalizeUnit(expected_unidad);
  const db = normalizeUnit(db_unidad);
  if (db === mod) return 1;
  const key = `${db}→${mod}`;
  const factor = CONVERSION_FACTORS[key];
  if (factor) return factor;
  const reverse = CONVERSION_FACTORS[`${mod}→${db}`];
  if (reverse) return 1 / reverse;
  return 1;
}
