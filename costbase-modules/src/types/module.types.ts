export type InsumoTipo = string;

export type ResolverWarningCode =
  | 'unmapped'
  | 'not_found'
  | 'no_price'
  | 'unit_unconverted'
  | 'category_mismatch';

export interface ResolverWarning {
  code: ResolverWarningCode;
  insumo_tipo: string;
  message: string;
}

export interface ParametroDefinicion {
  label: string;
  tipo: 'number' | 'select' | 'boolean';
  unidad?: string;
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: Array<{ value: number | string; label: string }>;
}

export interface InsumoRequerido {
  tipo: InsumoTipo;
  cantidad: number;
  unidad: string;
  desperdicio?: number;
  cantidad_total?: number;
  descripcion?: string;
}

export interface ResultadoModulo {
  module_code: string;
  module_name: string;
  categoria: string;
  params_used: Record<string, unknown>;
  unidad_modulo: string;
  insumos: InsumoRequerido[];
  fuentes_norma: string[];
}

export interface ModuloDefinicion {
  code: string;
  name: string;
  categoria: string;
  unidad: string;
  params: Record<string, ParametroDefinicion>;
  calcular: (params: Record<string, unknown>) => ResultadoModulo;
}

export interface InsumoConPrecio extends InsumoRequerido {
  cantidad_total: number;
  insumo_id: string;
  nombre_db: string;
  precio_unitario: number;
  subtotal: number;
  fuente_precio: string;
  confianza: number;
  unidad_db?: string | null;
  conversion_aplicada?: string | null;
  flags?: string[];
}

export interface ResultadoConPrecios extends ResultadoModulo {
  region_id: number;
  insumos_con_precio: InsumoConPrecio[];
  totales: {
    materiales: number;
    mano_obra: number;
    maquinaria: number;
    costo_directo: number;
  };
  warnings: ResolverWarning[];
  validation?: {
    concepto_ref_clave?: string;
    concepto_ref_nombre?: string;
    concepto_ref_precio?: number;
    delta_pct?: number;
    status: 'ok' | 'warning' | 'no_ref';
  };
}
