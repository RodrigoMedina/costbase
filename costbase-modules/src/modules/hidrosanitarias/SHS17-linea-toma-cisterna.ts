import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';

interface SHS17Params {
  long_ml: number;
  diametro: '1/2' | '3/4' | '1';
  material: 'cobre' | 'pvc';
}

export const SHS17: ModuloDefinicion = {
  code: 'SHS17',
  name: 'LINEA DE TOMA A CISTERNA',
  categoria: 'SALIDAS HIDROSANITARIAS',
  unidad: 'ML',

  params: {
    long_ml: { label: 'Longitud (ml)', tipo: 'number', default: 20, min: 1, max: 100 },
    diametro: { label: 'Diámetro', tipo: 'select', default: '3/4', options: [{ value: '1/2', label: '1/2"' }, { value: '3/4', label: '3/4"' }, { value: '1', label: '1"' }] },
    material: { label: 'Material', tipo: 'select', default: 'cobre', options: [{ value: 'cobre', label: 'Cobre' }, { value: 'pvc', label: 'PVC' }] },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as SHS17Params;
    const metro_tubo = p.long_ml * 1.05;
    const fittings = Math.ceil(p.long_ml * 0.35);

    const tubo_tipo = p.material === 'cobre'
      ? (p.diametro === '1/2' ? T.TUBO_COBRE_12 : T.TUBO_COBRE_34)
      : (p.diametro === '3/4' ? T.TUBO_PVC_34 : T.TUBO_PVC_1);

    return {
      module_code: 'SHS17',
      module_name: 'LINEA DE TOMA A CISTERNA',
      categoria: 'SALIDAS HIDROSANITARIAS',
      params_used: { ...p },
      unidad_modulo: 'ML',
      insumos: [
        { tipo: tubo_tipo, cantidad: metro_tubo, unidad: 'ML' },
        { tipo: T.COPLE_COBRE, cantidad: fittings, unidad: 'PZA' },
        { tipo: T.MO_PLOMERO, cantidad: 0.05, unidad: 'JOR' },
      ],
      fuentes_norma: ['NOM-001-CONAGUA §5', 'IAPMO UPC'],
    };
  },
};
