import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';
import { PESO_VARILLA, perimEstribo, nEstribos } from '../../constants/materiales.constants';

interface P1Params {
  lado_m: number;
  profundidad_m: number;
  n_secciones: number;
  fc: 200 | 250 | 300;
  diam_long: string;
  n_varillas: number;
  diam_estribo: string;
  sep_estribos_cm: number;
}

export const P1: ModuloDefinicion = {
  code: 'P1',
  name: 'PILOTE 1',
  categoria: 'CIMENTACION PILAS Y PILOTES',
  unidad: 'ML',

  params: {
    lado_m: { label: 'Lado del pilote (m)', tipo: 'number', default: 0.40, min: 0.30, max: 1.00 },
    profundidad_m: { label: 'Profundidad (m)', tipo: 'number', default: 15.0, min: 5.0, max: 30.0 },
    n_secciones: { label: 'Número secciones', tipo: 'select', default: 3, options: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }] },
    fc: { label: "f'c (kg/cm²)", tipo: 'select', default: 250, options: [{ value: 200, label: '200' }, { value: 250, label: '250' }, { value: 300, label: '300' }] },
    diam_long: { label: 'Varilla longitudinal', tipo: 'select', default: 'no8', options: [{ value: 'no6', label: 'No.6 (3/4")' }, { value: 'no8', label: 'No.8 (1")' }] },
    n_varillas: { label: 'Número varillas', tipo: 'select', default: 8, options: [{ value: 6, label: '6' }, { value: 8, label: '8' }, { value: 10, label: '10' }] },
    diam_estribo: { label: 'Varilla estribos', tipo: 'select', default: 'no3', options: [{ value: 'no3', label: 'No.3 (3/8")' }] },
    sep_estribos_cm: { label: 'Sep. estribos (cm)', tipo: 'number', default: 15, min: 10, max: 25 },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as P1Params;
    const area_sec = p.lado_m * p.lado_m;
    const perim_sec = 4 * p.lado_m;
    const vol_concreto = area_sec * p.profundidad_m;

    const kg_long = p.n_varillas * PESO_VARILLA[p.diam_long] * p.profundidad_m * 1.10;

    const perim = perimEstribo(p.lado_m * 100, p.lado_m * 100, 5);
    const n_estr_total = nEstribos(p.sep_estribos_cm) * (p.profundidad_m / 1.0);
    const kg_estribos = PESO_VARILLA[p.diam_estribo] * perim * n_estr_total;

    const perf_hincado = 42;
    const perf_perforacion = 1;
    const placas_conexion = p.n_secciones * 2 * 10;

    return {
      module_code: 'P1',
      module_name: 'PILOTE 1',
      categoria: 'CIMENTACION PILAS Y PILOTES',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: T.EXCAVACION_MAQUINA, cantidad: perf_perforacion, unidad: 'ML', descripcion: 'Perforación previa' },
        { tipo: T.CIMBRA_COLUMNAS, cantidad: perim_sec * p.profundidad_m, unidad: 'M2', desperdicio: 0.05 },
        { tipo: `concreto_fc${p.fc}`, cantidad: vol_concreto, unidad: 'M3', desperdicio: 0.05 },
        { tipo: T.ACERO_NO8, cantidad: kg_long + kg_estribos, unidad: 'KG', desperdicio: 0.05 },
        { tipo: T.ALAMBRE_RECOCIDO, cantidad: (kg_long + kg_estribos) * 0.02, unidad: 'KG' },
        { tipo: T.PLACA_ACERO, cantidad: placas_conexion, unidad: 'KG', descripcion: 'Placas de empate entre secciones' },
        { tipo: T.EXCAVACION_MAQUINA, cantidad: perf_hincado, unidad: 'ML', descripcion: 'Hincado de pilote' },
        { tipo: T.MO_FIERRERO, cantidad: 0.25, unidad: 'JOR' },
        { tipo: T.MO_ALBANIL_PEON, cantidad: 0.35, unidad: 'JOR' },
      ],
      fuentes_norma: ['NTC-CDMX Cimentaciones 2017 §8 Pilotes', 'ACI 318-19 §18 Deep Foundations'],
    };
  },
};
