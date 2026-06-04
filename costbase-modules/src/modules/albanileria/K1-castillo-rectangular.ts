import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';
import { PESO_VARILLA, perimEstribo, nEstribos } from '../../constants/materiales.constants';

interface K1Params {
  base_cm: number;
  alto_cm: number;
  fc: 200 | 250;
  n_varillas: 4 | 6;
  diam_long: string;
  diam_estribo: string;
  sep_estribos_cm: number;
}

export const K1: ModuloDefinicion = {
  code: 'K1',
  name: 'CASTILLO RECTANGULAR',
  categoria: 'ALBANILERIA CASTILLOS',
  unidad: 'ML',

  params: {
    base_cm: { label: 'Base (cm)', tipo: 'number', default: 15, min: 12, max: 25 },
    alto_cm: { label: 'Altura (cm)', tipo: 'number', default: 20, min: 12, max: 25 },
    fc: { label: "f'c (kg/cm²)", tipo: 'select', default: 200, options: [{ value: 200, label: '200' }, { value: 250, label: '250' }] },
    n_varillas: { label: 'Varillas', tipo: 'select', default: 4, options: [{ value: 4, label: '4' }, { value: 6, label: '6' }] },
    diam_long: { label: 'Diámetro varillas', tipo: 'select', default: 'no3', options: [{ value: 'no3', label: 'No.3 (3/8")' }, { value: 'no4', label: 'No.4 (1/2")' }] },
    diam_estribo: { label: 'Diámetro estribos', tipo: 'select', default: 'no3', options: [{ value: 'no2', label: 'No.2 (1/4")' }, { value: 'no3', label: 'No.3 (3/8")' }] },
    sep_estribos_cm: { label: 'Sep. estribos (cm)', tipo: 'number', default: 20, min: 15, max: 30 },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as K1Params;
    const area_sec = (p.base_cm * p.alto_cm) / 10000;
    const vol_concreto = area_sec * 1.0;
    const kg_long = p.n_varillas * PESO_VARILLA[p.diam_long] * 1.05;
    const perim = perimEstribo(p.base_cm, p.alto_cm, 3);
    const n_estr = nEstribos(p.sep_estribos_cm);
    const kg_estr = PESO_VARILLA[p.diam_estribo] * perim * n_estr;
    const perim_col = (2 * p.base_cm + 2 * p.alto_cm) / 100;
    const m2_cimbra = perim_col * 1.05;
    const kg_total = kg_long + kg_estr;

    return {
      module_code: 'K1',
      module_name: 'CASTILLO RECTANGULAR',
      categoria: 'ALBANILERIA CASTILLOS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: `concreto_fc${p.fc}`, cantidad: vol_concreto, unidad: 'M3', desperdicio: 0.03 },
        { tipo: T.ACERO_NO3, cantidad: kg_total, unidad: 'KG', desperdicio: 0.05 },
        { tipo: T.ALAMBRE_RECOCIDO, cantidad: kg_total * 0.02, unidad: 'KG' },
        { tipo: T.CIMBRA_CASTILLOS, cantidad: m2_cimbra, unidad: 'M2', desperdicio: 0.05 },
        { tipo: T.MO_ALBANIL_PEON, cantidad: 0.25, unidad: 'JOR' },
        { tipo: T.MO_FIERRERO, cantidad: 0.12, unidad: 'JOR' },
      ],
      fuentes_norma: ['NTC-CDMX Mampostería 2017 §5 Castillos', 'CMIC Manual de Rendimientos Mampostería 2022'],
    };
  },
};
