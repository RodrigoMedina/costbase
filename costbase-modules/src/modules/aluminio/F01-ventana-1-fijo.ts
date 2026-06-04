import { ModuloDefinicion, ResultadoModulo } from '../../types/module.types';
import { INSUMO_TIPOS as T } from '../../types/insumo-tipos';

interface F01Params {
  ancho_m: number;
  alto_m: number;
  tipo_vidrio: 'claro_4mm' | 'claro_6mm';
  color_aluminio: 'natural' | 'duranodick';
}

export const F01: ModuloDefinicion = {
  code: 'F01',
  name: 'VENTANA 1 FIJO',
  categoria: 'ALUMINIO FIJOS',
  unidad: 'PZA',

  params: {
    ancho_m: { label: 'Ancho (m)', tipo: 'number', default: 1.5, min: 0.6, max: 4.0 },
    alto_m: { label: 'Altura (m)', tipo: 'number', default: 1.6, min: 0.6, max: 3.0 },
    tipo_vidrio: { label: 'Tipo vidrio', tipo: 'select', default: 'claro_4mm', options: [{ value: 'claro_4mm', label: 'Claro 4mm' }, { value: 'claro_6mm', label: 'Claro 6mm' }] },
    color_aluminio: { label: 'Color aluminio', tipo: 'select', default: 'natural', options: [{ value: 'natural', label: 'Natural anodizado' }, { value: 'duranodick', label: 'Duranodick' }] },
  },

  calcular(raw: Record<string, unknown>): ResultadoModulo {
    const p = raw as unknown as F01Params;
    const perim_frame = 2 * (p.ancho_m + p.alto_m) * 1.10;
    const kg_aluminio = perim_frame * 2.5;
    const area_vidrio = p.ancho_m * p.alto_m * 0.95;

    const vidrio_tipo = p.tipo_vidrio === 'claro_6mm' ? T.VIDRIO_6MM : T.VIDRIO_4MM;
    const neopreno_ancho_m = 0.01;
    const area_neopreno = perim_frame * neopreno_ancho_m;

    return {
      module_code: 'F01',
      module_name: 'VENTANA 1 FIJO',
      categoria: 'ALUMINIO FIJOS',
      params_used: { ...p },
      unidad_modulo: 'PZA',
      insumos: [
        { tipo: T.PERFIL_ALUMINIO, cantidad: kg_aluminio, unidad: 'KG', desperdicio: 0.05 },
        { tipo: vidrio_tipo, cantidad: area_vidrio, unidad: 'M2', desperdicio: 0.03 },
        { tipo: T.HULE_NEOPRENO, cantidad: area_neopreno, unidad: 'M2', desperdicio: 0.05, descripcion: 'Junta perimetral' },
        { tipo: T.TORNILLERIA_ALUMINIO, cantidad: perim_frame * 0.3, unidad: 'PZA' },
        { tipo: T.SELLADOR_SILICON, cantidad: perim_frame * 0.05, unidad: 'PZA' },
        { tipo: T.MO_ALUMINIERO, cantidad: 0.08, unidad: 'JOR' },
      ],
      fuentes_norma: ['Especificaciones CUPRUM/VALSA', 'AAMA Standards for Aluminum Windows'],
    };
  },
};
