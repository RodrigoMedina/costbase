import { ModuloDefinicion, ResultadoModulo, InsumoRequerido } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';
import { K1 } from './K1-castillo-rectangular';

interface M1Params {
  altura_muro_m: number;
  con_castillos: boolean;
  tipo_mortero: '1:4' | '1:5' | '1:6';
}

const CASTILLO_SPACING_M = 2.4;

function castilloLinesPerM2(): InsumoRequerido[] {
  const k1Defaults = {
    base_cm: 15,
    alto_cm: 20,
    fc: 200,
    n_varillas: 4,
    diam_long: 'no3',
    diam_estribo: 'no3',
    sep_estribos_cm: 20,
  };
  const k1 = K1.calcular(k1Defaults);
  const ml_castillo_por_m2 = 1 / CASTILLO_SPACING_M;

  return k1.insumos
    .filter((ins) => !ins.tipo.match(/^[0-9]/))
    .map((ins) => ({
      tipo: ins.tipo,
      cantidad: ins.cantidad * ml_castillo_por_m2,
      unidad: ins.unidad,
      desperdicio: ins.desperdicio,
      descripcion: `Castillo @${CASTILLO_SPACING_M}m`,
    }));
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
    const largo_tab = 0.28;
    const alto_tab = 0.065;
    const piezas_m2 = (1 / ((largo_tab + junta) * (alto_tab + junta))) * 1.05;
    const vol_mortero_m2 = 0.030;
    const factor_andamio = p.altura_muro_m > 3.5 ? 1.15 : 1.0;
    const jor_base = 0.28 * factor_andamio;

    const mortero_tipo =
      p.tipo_mortero === '1:4' ? T.MORTERO_1_4 : p.tipo_mortero === '1:5' ? T.MORTERO_1_5 : T.MORTERO_1_6;

    const insumos: InsumoRequerido[] = [
      { tipo: T.TABIQUE_14, cantidad: piezas_m2, unidad: 'PZA', desperdicio: 0.03 },
      { tipo: mortero_tipo, cantidad: vol_mortero_m2, unidad: 'M3', desperdicio: 0.05 },
      { tipo: T.MO_ALBANIL_PEON, cantidad: jor_base, unidad: 'JOR' },
    ];

    if (p.con_castillos) {
      insumos.push(...castilloLinesPerM2());
    }

    return {
      module_code: 'M1',
      module_name: 'MURO DE TABIQUE 14CM',
      categoria: 'ALBANILERIA MUROS',
      params_used: { ...p },
      unidad_modulo: 'M2',
      insumos,
      fuentes_norma: ['NMX-C-006-ONNCCE Tabique', 'CMIC Manual de Rendimientos Mampostería 2022', 'NTC-CDMX Mampostería 2017 §3'],
    };
  },
};
