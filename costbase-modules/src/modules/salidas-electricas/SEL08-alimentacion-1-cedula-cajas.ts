import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';

interface SEL08Params {
  long_ml: number;
  calibre: '12' | '10' | '8';
  tipo_conduit: 'emt' | 'pvc';
}

export const SEL08: ModuloDefinicion = {
  code: 'SEL08',
  name: 'ALIMENTACION ELEC 1 CEDULA CAJAS',
  categoria: 'SALIDAS ELECTRICAS',
  unidad: 'ML',

  params: {
    long_ml: { label: 'Longitud (ml)', tipo: 'number', default: 20, min: 1, max: 100 },
    calibre: { label: 'Calibre cable', tipo: 'select', default: '10', options: [{ value: '12', label: '12 AWG' }, { value: '10', label: '10 AWG' }, { value: '8', label: '8 AWG' }] },
    tipo_conduit: { label: 'Tipo conduit', tipo: 'select', default: 'emt', options: [{ value: 'emt', label: 'EMT (galvanizado)' }, { value: 'pvc', label: 'PVC' }] },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as SEL08Params;
    const metros_cable = p.long_ml * 3 * 1.05;
    const metros_conduit = p.long_ml * 1.03;
    const cajas = Math.ceil(p.long_ml / 10);

    const cable_tipo = p.calibre === '12' ? T.CABLE_THW_12 :
      p.calibre === '10' ? T.CABLE_THW_10 : T.CABLE_THW_8;
    const conduit_tipo = p.tipo_conduit === 'emt' ? T.CONDUIT_EMT_34 : T.CONDUIT_PVC_34;

    return {
      module_code: 'SEL08',
      module_name: 'ALIMENTACION ELEC 1 CEDULA CAJAS',
      categoria: 'SALIDAS ELECTRICAS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: cable_tipo, cantidad: metros_cable, unidad: 'ML', desperdicio: 0.05 },
        { tipo: conduit_tipo, cantidad: metros_conduit, unidad: 'ML' },
        { tipo: T.CAJA_REGISTRO, cantidad: cajas, unidad: 'PZA' },
        { tipo: T.CINTA_AISLANTE, cantidad: p.long_ml * 0.02, unidad: 'PZA' },
        { tipo: T.MO_ELECTRICISTA, cantidad: 0.06, unidad: 'JOR' },
      ],
      fuentes_norma: ['NOM-001-SEDE-2012 §310, §362', 'CFE Especificaciones instalaciones'],
    };
  },
};
