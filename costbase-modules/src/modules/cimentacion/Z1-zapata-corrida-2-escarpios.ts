import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';
import { PESO_VARILLA, perimEstribo, nEstribos } from '../../constants/materiales.constants';

interface Z1Params {
  ancho_inferior_m: number;
  ancho_superior_m: number;
  altura_base_m: number;
  altura_escarpe_m: number;
  fc: 150 | 200 | 250 | 300;
  long_varilla_long: string;
  n_varillas_long: number;
  long_varilla_trans: string;
  sep_estribos_cm: number;
}

export const Z1: ModuloDefinicion = {
  code: 'Z1',
  name: 'ZAPATA CORRIDA 2 ESCARPIOS',
  categoria: 'CIMENTACION ZAPATAS',
  unidad: 'ML',

  params: {
    ancho_inferior_m: { label: 'Ancho inferior (m)', tipo: 'number', default: 0.80, min: 0.40, max: 2.00 },
    ancho_superior_m: { label: 'Ancho superior (m)', tipo: 'number', default: 0.20, min: 0.10, max: 0.60 },
    altura_base_m: { label: 'Altura base (m)', tipo: 'number', default: 0.15, min: 0.10, max: 0.40 },
    altura_escarpe_m: { label: 'Altura escarpe (m)', tipo: 'number', default: 0.45, min: 0.20, max: 0.80 },
    fc: { label: "f'c (kg/cm²)", tipo: 'select', default: 250, options: [{ value: 150, label: '150' }, { value: 200, label: '200' }, { value: 250, label: '250' }, { value: 300, label: '300' }] },
    long_varilla_long: { label: 'Varilla longitudinal', tipo: 'select', default: 'no4', options: [{ value: 'no3', label: 'No.3 (3/8")' }, { value: 'no4', label: 'No.4 (1/2")' }, { value: 'no5', label: 'No.5 (5/8")' }] },
    n_varillas_long: { label: 'Número varillas long', tipo: 'number', default: 3, min: 2, max: 6 },
    long_varilla_trans: { label: 'Varilla transversal', tipo: 'select', default: 'no3', options: [{ value: 'no3', label: 'No.3 (3/8")' }, { value: 'no4', label: 'No.4 (1/2")' }] },
    sep_estribos_cm: { label: 'Sep. estribos (cm)', tipo: 'number', default: 20, min: 10, max: 30 },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as Z1Params;
    const ancho_exc = p.ancho_inferior_m + 0.60;
    const altura_total = p.altura_base_m + p.altura_escarpe_m;
    const vol_excavacion = ancho_exc * altura_total * 1.0;
    const area_plantilla = p.ancho_inferior_m * 1.0;

    const vol_concreto = (p.ancho_superior_m * p.altura_base_m) + ((p.ancho_inferior_m + p.ancho_superior_m) / 2) * p.altura_escarpe_m;

    const kg_long = p.n_varillas_long * PESO_VARILLA[p.long_varilla_long] * 1.05;
    const b_estr_cm = p.ancho_superior_m * 100;
    const h_estr_cm = (p.altura_base_m + p.altura_escarpe_m) * 100;
    const perim = perimEstribo(b_estr_cm, h_estr_cm, 5);
    const n_estr_pm = nEstribos(p.sep_estribos_cm);
    const kg_trans = PESO_VARILLA[p.long_varilla_trans] * perim * n_estr_pm;
    const kg_acero = kg_long + kg_trans;

    const run_escarpe = (p.ancho_inferior_m - p.ancho_superior_m) / 2;
    const hipo = Math.sqrt(run_escarpe * run_escarpe + p.altura_escarpe_m * p.altura_escarpe_m);
    const m2_cimbra = (2 * hipo + 2 * p.altura_base_m) * 1.0;

    const vol_relleno = Math.max(0, vol_excavacion - vol_concreto - area_plantilla * 0.05);
    const vol_acarreo = vol_excavacion * 1.25;

    const concreto_tipo = `concreto_fc${p.fc}`;

    return {
      module_code: 'Z1',
      module_name: 'ZAPATA CORRIDA 2 ESCARPIOS',
      categoria: 'CIMENTACION ZAPATAS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: T.EXCAVACION_MANUAL, cantidad: vol_excavacion, unidad: 'M3', descripcion: 'Excavación para cimentación' },
        { tipo: T.PLANTILLA, cantidad: area_plantilla, unidad: 'M2', descripcion: 'Plantilla concreto pobre' },
        { tipo: concreto_tipo, cantidad: vol_concreto, unidad: 'M3', desperdicio: 0.03 },
        { tipo: T.ACERO_NO4, cantidad: kg_acero, unidad: 'KG', desperdicio: 0.05 },
        { tipo: T.CIMBRA_ZAPATAS, cantidad: m2_cimbra, unidad: 'M2', desperdicio: 0.05 },
        { tipo: T.RELLENO_COMPACTADO, cantidad: vol_relleno, unidad: 'M3' },
        { tipo: T.ACARREO, cantidad: vol_acarreo, unidad: 'M3', descripcion: 'Acarreo material excavado' },
        { tipo: T.MO_ALBANIL_PEON, cantidad: 0.30, unidad: 'JOR', descripcion: 'Colocación concreto y cimbra' },
        { tipo: T.MO_FIERRERO, cantidad: 0.15, unidad: 'JOR', descripcion: 'Habilitado acero' },
      ],
      fuentes_norma: ['NTC-CDMX Cimentaciones 2017 §4.3', 'CMIC Manual de Rendimientos Cimentaciones 2022', 'ACI 318-19 §13 Footings'],
    };
  },
};
