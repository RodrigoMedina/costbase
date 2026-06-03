import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';

interface M1Params {
  altura_muro_m: number;
  con_castillos: boolean;
  tipo_mortero: '1:4' | '1:5' | '1:6';
}

export const M1: ModuloDefinicion = {
  code: 'M1',
  name: 'MURO DE TABIQUE 14CM',
  categoria: 'ALBANILERIA MUROS',
  unidad: 'M2',

  params: {
    altura_muro_m: { label: 'Altura del muro (m)', tipo: 'number', default: 2.8, min: 1.0, max: 6.0 },
    con_castillos: { label: 'Incluir castillos', tipo: 'boolean', default: true },
    tipo_mortero: { label: 'Tipo mortero', tipo: 'select', default: '1:5', options: [{ value: '1:4', label: '1:4' }, { value: '1:5', label: '1:5' }, { value: '1:6', label: '1:6' }] },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as M1Params;
    const junta = 0.01;
    const largo_tab = 0.28, alto_tab = 0.065;
    const piezas_m2 = (1 / ((largo_tab + junta) * (alto_tab + junta))) * 1.05;
    const vol_mortero_m2 = 0.030;
    const factor_andamio = p.altura_muro_m > 3.5 ? 1.15 : 1.0;
    const jor_base = 0.28 * factor_andamio;
    const jor_castillo = p.con_castillos ? 0.05 : 0;

    const mortero_tipo = p.tipo_mortero === '1:4' ? T.MORTERO_1_4 :
      p.tipo_mortero === '1:5' ? T.MORTERO_1_5 : T.MORTERO_1_6;

    return {
      module_code: 'M1',
      module_name: 'MURO DE TABIQUE 14CM',
      categoria: 'ALBANILERIA MUROS',
      params_used: { ...p },
      unidad_modulo: 'M2',
      insumos: [
        { tipo: T.TABIQUE_14, cantidad: piezas_m2, unidad: 'PZA', desperdicio: 0.03 },
        { tipo: mortero_tipo, cantidad: vol_mortero_m2, unidad: 'M3', desperdicio: 0.05 },
        { tipo: T.MO_ALBANIL_PEON, cantidad: jor_base + jor_castillo, unidad: 'JOR' },
      ],
      fuentes_norma: ['NMX-C-006-ONNCCE Tabique', 'CMIC Manual de Rendimientos Mampostería 2022', 'NTC-CDMX Mampostería 2017 §3'],
    };
  },
};
