import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';

interface E1Params {
  altura_m: number;
  ancho_m: number;
  inclinacion: 45 | 60 | 70;
}

export const E1: ModuloDefinicion = {
  code: 'E1',
  name: 'ESCALERA MARINA',
  categoria: 'HERRERIA',
  unidad: 'TRAMO',

  params: {
    altura_m: { label: 'Altura (m)', tipo: 'number', default: 3.0, min: 1.5, max: 6.0 },
    ancho_m: { label: 'Ancho (m)', tipo: 'number', default: 0.8, min: 0.6, max: 1.2 },
    inclinacion: { label: 'Inclinación (°)', tipo: 'select', default: 60, options: [{ value: 45, label: '45°' }, { value: 60, label: '60°' }, { value: 70, label: '70° (empinada)' }] },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as E1Params;
    const rad = p.inclinacion * Math.PI / 180;
    const long_piso = p.altura_m / Math.tan(rad);
    const long_escalera = Math.sqrt(p.altura_m * p.altura_m + long_piso * long_piso);
    const n_peldaños = Math.ceil(p.altura_m / 0.25);

    const kg_tubos_laterales = 2 * long_escalera * 2.0;
    const kg_peldaños = n_peldaños * p.ancho_m * 1.5;
    const kg_platina = n_peldaños * p.ancho_m * 0.3;
    const kg_total = kg_tubos_laterales + kg_peldaños + kg_platina;

    const area_pintura = (kg_tubos_laterales * 0.5 + kg_peldaños * 0.3) * 2;

    return {
      module_code: 'E1',
      module_name: 'ESCALERA MARINA',
      categoria: 'HERRERIA',
      params_used: { ...p },
      unidad_modulo: 'TRAMO',
      insumos: [
        { tipo: T.TUBO_REDONDO, cantidad: kg_tubos_laterales + kg_peldaños, unidad: 'KG', desperdicio: 0.05 },
        { tipo: T.PLATINA_ACERO, cantidad: kg_platina, unidad: 'KG', desperdicio: 0.05 },
        { tipo: T.SOLDADURA_ELECTRODO, cantidad: kg_total * 0.05, unidad: 'KG' },
        { tipo: T.PINTURA_ESMALTE, cantidad: area_pintura * 0.15, unidad: 'LT' },
        { tipo: T.MO_HERRERO, cantidad: 0.30, unidad: 'JOR' },
        { tipo: T.MO_SOLDADOR, cantidad: 0.20, unidad: 'JOR' },
        { tipo: T.MO_AYUDANTE, cantidad: 0.15, unidad: 'JOR' },
      ],
      fuentes_norma: ['CMIC Manual de Rendimientos Herrería 2022', 'NTC-CDMX Acero 2017 §3'],
    };
  },
};
