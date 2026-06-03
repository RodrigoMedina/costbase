export const PESO_VARILLA: Record<string, number> = {
  'no2': 0.248,
  'no3': 0.560,
  'no4': 0.994,
  'no5': 1.552,
  'no6': 2.235,
  'no8': 3.973,
  'no10': 6.404,
};

export function perimEstribo(b_cm: number, h_cm: number, rec_cm: number = 4): number {
  const b_net = (b_cm - 2 * rec_cm) / 100;
  const h_net = (h_cm - 2 * rec_cm) / 100;
  return 2 * b_net + 2 * h_net + 0.25;
}

export function nEstribos(sep_cm: number): number {
  return Math.ceil(100 / sep_cm) + 1;
}

export function areaCircular_cm2(diam_mm: number): number {
  return Math.PI * Math.pow(diam_mm / 20, 2);
}
