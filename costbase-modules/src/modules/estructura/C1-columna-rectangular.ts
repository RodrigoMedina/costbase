import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';
import { PESO_VARILLA, perimEstribo, nEstribos } from '../../constants/materiales.constants';

interface C1Params {
  base_cm: number;
  alto_cm: number;
  fc: 200 | 250 | 300;
  n_varillas: 4 | 6 | 8;
  diam_long: string;
  diam_estribo: string;
  sep_estribos_cm: number;
}

export const C1: ModuloDefinicion = {
  code: 'C1',
  name: 'COLUMNA RECTANGULAR',
  categoria: 'ESTRUCTURA COLUMNAS Y MUROS',
  unidad: 'ML',

  params: {
    base_cm: { label: 'Base (cm)', tipo: 'number', default: 30, min: 15, max: 60 },
    alto_cm: { label: 'Altura (cm)', tipo: 'number', default: 30, min: 15, max: 60 },
    fc: { label: "f'c (kg/cm²)", tipo: 'select', default: 250, options: [{ value: 200, label: '200' }, { value: 250, label: '250' }, { value: 300, label: '300' }] },
    n_varillas: { label: 'Varillas longitudinales', tipo: 'select', default: 6, options: [{ value: 4, label: '4' }, { value: 6, label: '6' }, { value: 8, label: '8' }] },
    diam_long: { label: 'Diámetro varillas', tipo: 'select', default: 'no4', options: [{ value: 'no3', label: 'No.3 (3/8")' }, { value: 'no4', label: 'No.4 (1/2")' }, { value: 'no5', label: 'No.5 (5/8")' }, { value: 'no6', label: 'No.6 (3/4")' }] },
    diam_estribo: { label: 'Diámetro estribos', tipo: 'select', default: 'no3', options: [{ value: 'no3', label: 'No.3 (3/8")' }, { value: 'no4', label: 'No.4 (1/2")' }] },
    sep_estribos_cm: { label: 'Sep. estribos (cm)', tipo: 'number', default: 20, min: 10, max: 30 },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as C1Params;
    const area_sec = (p.base_cm * p.alto_cm) / 10000;
    const vol_concreto = area_sec * 1.0;
    const kg_long = p.n_varillas * PESO_VARILLA[p.diam_long] * 1.05;
    const perim = perimEstribo(p.base_cm, p.alto_cm, 4);
    const n_estr = nEstribos(p.sep_estribos_cm);
    const kg_estr = PESO_VARILLA[p.diam_estribo] * perim * n_estr;
    const m2_cimbra = (2 * p.base_cm + 2 * p.alto_cm) / 100 * 1.05;

    const acero_tipo = kg_long > kg_estr
      ? (p.diam_long === 'no6' ? T.ACERO_NO6 : p.diam_long === 'no5' ? T.ACERO_NO5 : p.diam_long === 'no4' ? T.ACERO_NO4 : T.ACERO_NO3)
      : T.ACERO_NO3;

    const kg_total = kg_long + kg_estr;

    return {
      module_code: 'C1',
      module_name: 'COLUMNA RECTANGULAR',
      categoria: 'ESTRUCTURA COLUMNAS Y MUROS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: `concreto_fc${p.fc}`, cantidad: vol_concreto, unidad: 'M3', desperdicio: 0.03 },
        { tipo: acero_tipo, cantidad: kg_total, unidad: 'KG', desperdicio: 0.05 },
        { tipo: T.ALAMBRE_RECOCIDO, cantidad: kg_total * 0.02, unidad: 'KG' },
        { tipo: T.CIMBRA_COLUMNAS, cantidad: m2_cimbra, unidad: 'M2', desperdicio: 0.05 },
        { tipo: T.MO_ALBANIL_PEON, cantidad: 0.45, unidad: 'JOR' },
        { tipo: T.MO_FIERRERO, cantidad: 0.20, unidad: 'JOR' },
      ],
      fuentes_norma: ['NTC-CDMX Concreto 2017 §6.2', 'ACI 318-19 §10'],
    };
  },
};
