const CONVERSION_FACTORS: Record<string, number> = {
  'MIL→PZA': 1000,
  'TON→KG': 1000,
  'L→M3': 0.001,
  'M3→L': 1000,
};

export function getConversionFactor(db_unidad: string, expected_unidad: string): number {
  if (db_unidad === expected_unidad) return 1;

  const key = `${db_unidad}→${expected_unidad}`;
  const factor = CONVERSION_FACTORS[key];
  if (factor) return factor;

  const reverse_key = `${expected_unidad}→${db_unidad}`;
  const reverse_factor = CONVERSION_FACTORS[reverse_key];
  if (reverse_factor) return 1 / reverse_factor;

  return 1;
}
