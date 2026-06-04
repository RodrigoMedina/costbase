export type BindingSource = 'human' | 'auto_validated' | 'imported';

export type ExpectedFamilia =
  | 'concreto'
  | 'acero'
  | 'cimbra'
  | 'tabique'
  | 'vidrio_arquitectonico'
  | 'aluminio'
  | 'cobre'
  | 'pvc'
  | 'electricos'
  | 'mortero'
  | 'mano_obra'
  | 'maquinaria'
  | 'basico_obra'
  | 'pintura'
  | 'soldadura'
  | 'general';

export interface TipoBinding {
  insumo_id: string;
  /** Divide DB price by this to get price in module unit (e.g. MIL→PZA = 1000) */
  price_divisor?: number;
  /** When module unit is ML and DB is PZA: price_divisor = pieza_longitud_m */
  pieza_longitud_m?: number;
  expected_familia?: ExpectedFamilia;
  /** Reject resolution if insumo nombre contains any of these (uppercase) */
  forbidden_nombre_contains?: string[];
  source: BindingSource;
  notes?: string;
}
