import type { ExpectedFamilia, TipoBinding } from './tipo-binding.types';

const FAMILIA_PATTERNS: Record<ExpectedFamilia, { required?: string[]; forbidden: string[] }> = {
  vidrio_arquitectonico: {
    forbidden: ['FIBRA', 'BARRERA', 'AISLAMIENTO', 'RF-3100', 'LAMINADO'],
  },
  tabique: { forbidden: ['CASTILLO', 'DALA', 'BLOCK'] },
  concreto: { required: ['CONCRETO'], forbidden: ['CADWELD', 'MOLDE'] },
  acero: { forbidden: ['CADWELD', 'MOLDE', 'COBRE', 'PVC'] },
  cimbra: { required: ['CIMBRA'], forbidden: ['CASTILLO DE', 'PILOTE 1'] },
  cobre: { required: ['COBRE'], forbidden: ['PVC', 'TRANSICION', '50 MM'] },
  aluminio: { forbidden: ['VIDRIO', 'FIBRA'] },
  mortero: { required: ['MORTERO'], forbidden: [] },
  mano_obra: { forbidden: [] },
  maquinaria: { forbidden: ['TIERRA', 'VEGETAL'] },
  basico_obra: { forbidden: ['TIERRA VEGETAL', 'JARDINER'] },
  pintura: { required: ['PINTURA'], forbidden: [] },
  soldadura: { required: ['SOLDADURA'], forbidden: [] },
  electricos: { forbidden: [] },
  pvc: { required: ['PVC'], forbidden: ['COBRE'] },
  general: { forbidden: [] },
};

export interface InsumoRowForValidation {
  id: string;
  nombre: string;
  tipo: string;
  unidad: string;
}

export function validateBindingTarget(
  binding: TipoBinding,
  insumo: InsumoRowForValidation,
  module_unidad: string
): { ok: boolean; reason?: string } {
  const nombre = insumo.nombre.toUpperCase();

  for (const bad of binding.forbidden_nombre_contains ?? []) {
    if (nombre.includes(bad.toUpperCase())) {
      return { ok: false, reason: `nombre contains forbidden "${bad}"` };
    }
  }

  if (binding.expected_familia) {
    const rules = FAMILIA_PATTERNS[binding.expected_familia];
    for (const f of rules.forbidden) {
      if (nombre.includes(f)) {
        return { ok: false, reason: `familia ${binding.expected_familia}: forbidden "${f}"` };
      }
    }
    if (rules.required?.length) {
      const hasRequired = rules.required.some((r) => nombre.includes(r));
      if (!hasRequired) {
        return { ok: false, reason: `familia ${binding.expected_familia}: missing required keyword` };
      }
    }
  }

  if (binding.pieza_longitud_m && module_unidad.toUpperCase() === 'ML' && insumo.unidad.toUpperCase() === 'PZA') {
    return { ok: true };
  }

  return { ok: true };
}

export function computePriceDivisor(
  binding: TipoBinding,
  module_unidad: string,
  db_unidad: string
): number {
  if (binding.price_divisor != null && binding.price_divisor > 0) {
    return binding.price_divisor;
  }
  if (
    binding.pieza_longitud_m &&
    binding.pieza_longitud_m > 0 &&
    module_unidad.toUpperCase() === 'ML' &&
    db_unidad.toUpperCase() === 'PZA'
  ) {
    return binding.pieza_longitud_m;
  }
  const mod = module_unidad.toUpperCase();
  const db = db_unidad.toUpperCase();
  if (mod === db) return 1;
  if (db === 'MIL' && mod === 'PZA') return 1000;
  return 1;
}

/**
 * Packaged DB units (PZA, MIL) priced per piece/lot → smaller module units (ML, PZA)
 * must lower unit price after division.
 */
export function isConversionDirectionSuspicious(
  precio_db: number,
  precio_convertido: number,
  module_unidad: string,
  db_unidad: string,
  price_divisor: number
): boolean {
  if (precio_db <= 0 || price_divisor <= 1) return false;
  const mod = module_unidad.toUpperCase();
  const db = db_unidad.toUpperCase();
  const packagedToSmaller =
    (db === 'PZA' && (mod === 'ML' || mod === 'M')) ||
    (db === 'MIL' && mod === 'PZA');
  if (!packagedToSmaller) return false;
  return precio_convertido > precio_db * 1.001;
}
