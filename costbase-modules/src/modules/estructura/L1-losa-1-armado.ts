import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';
import { PESO_VARILLA } from '../../constants/materiales.constants';

interface L1Params {
  espesor_cm: number;
  fc: 200 | 250 | 300;
  diam_principal: string;
  sep_acero_cm: number;
  uso_malla: boolean;
}

export const L1: ModuloDefinicion = {
  code: 'L1',
  name: 'LOSA 1 ARMADO',
  categoria: 'ESTRUCTURA TRABES Y LOSAS',
  unidad: 'M2',

  params: {
    espesor_cm: { label: 'Espesor losa (cm)', tipo: 'number', default: 12, min: 8, max: 20 },
    fc: { label: "f'c (kg/cm²)", tipo: 'select', default: 250, options: [{ value: 200, label: '200' }, { value: 250, label: '250' }, { value: 300, label: '300' }] },
    diam_principal: { label: 'Diámetro acero', tipo: 'select', default: 'no3', options: [{ value: 'no3', label: 'No.3 (3/8")' }, { value: 'no4', label: 'No.4 (1/2")' }] },
    sep_acero_cm: { label: 'Separación acero (cm)', tipo: 'number', default: 20, min: 10, max: 30 },
    uso_malla: { label: 'Usar malla electrosoldada', tipo: 'boolean', default: false },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as L1Params;
    const vol_concreto = (p.espesor_cm / 100) * 1.0;

    let kg_acero = 0;
    let malla_m2 = 0;

    if (p.uso_malla) {
      malla_m2 = 1.0;
    } else {
      const barras_por_m = Math.ceil(100 / p.sep_acero_cm);
      kg_acero = barras_por_m * 2 * PESO_VARILLA[p.diam_principal] * 1.05;
    }

    const m2_cimbra = 1.05;
    const kg_alambre = 0.05;

    const insumos = [
      { tipo: `concreto_fc${p.fc}`, cantidad: vol_concreto, unidad: 'M3', desperdicio: 0.03 },
      { tipo: T.CIMBRA_LOSA, cantidad: m2_cimbra, unidad: 'M2', desperdicio: 0.05 },
      { tipo: T.ALAMBRE_RECOCIDO, cantidad: kg_alambre, unidad: 'KG' },
      { tipo: T.MO_CARPINTERO, cantidad: 0.12, unidad: 'JOR', descripcion: 'Cimbra losa' },
      { tipo: T.MO_FIERRERO, cantidad: 0.08, unidad: 'JOR', descripcion: 'Acero losa' },
      { tipo: T.MO_ALBANIL_PEON, cantidad: 0.15, unidad: 'JOR', descripcion: 'Colado losa' },
    ];

    if (p.uso_malla) {
      insumos.push({ tipo: T.MALLA_66_1010, cantidad: malla_m2, unidad: 'M2', desperdicio: 0.03 });
    } else {
      const acero_tipo = p.diam_principal === 'no4' ? T.ACERO_NO4 : T.ACERO_NO3;
      insumos.push({ tipo: acero_tipo, cantidad: kg_acero, unidad: 'KG', desperdicio: 0.05 });
    }

    return {
      module_code: 'L1',
      module_name: 'LOSA 1 ARMADO',
      categoria: 'ESTRUCTURA TRABES Y LOSAS',
      params_used: { ...p },
      unidad_modulo: 'M2',
      insumos,
      fuentes_norma: ['NTC-CDMX Concreto 2017 §5 Losas', 'ACI 318-19 §8'],
    };
  },
};
