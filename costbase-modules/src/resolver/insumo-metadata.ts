export interface InsumoMeta {
  tipo_db: 'material' | 'mano_obra' | 'maquinaria' | 'basico_obra' | 'subcontrato' | 'herramienta';
  keywords?: string[];
  exact_field?: string;
  exact_value?: string;
  exclude_keywords?: string[];
  unidad_esperada: string;
  unidad_label?: string;
}

const INSUMO_METADATA: Record<string, InsumoMeta> = {
  // ── Concretos ──────────────────────────────────────
  concreto_fc150: {
    tipo_db: 'material',
    keywords: ['CONCRETO', 'PREMEZCLADO', '150'],
    unidad_esperada: 'M3',
  },
  concreto_fc200: {
    tipo_db: 'material',
    keywords: ['CONCRETO', 'PREMEZCLADO', '200'],
    unidad_esperada: 'M3',
  },
  concreto_fc250: {
    tipo_db: 'material',
    keywords: ['CONCRETO', 'PREMEZCLADO', '250'],
    unidad_esperada: 'M3',
  },
  concreto_fc300: {
    tipo_db: 'material',
    keywords: ['CONCRETO', 'PREMEZCLADO', '300'],
    unidad_esperada: 'M3',
  },
  concreto_pobre: {
    tipo_db: 'material',
    keywords: ['CONCRETO', 'PREMEZCLADO', '100'],
    unidad_esperada: 'M3',
  },

  // ── Acero de refuerzo ──────────────────────────────
  acero_no3: {
    tipo_db: 'material',
    keywords: ['VARILLA', 'R-42', 'No. 3'],
    unidad_esperada: 'KG',
  },
  acero_no4: {
    tipo_db: 'material',
    keywords: ['VARILLA', 'R-42', 'No. 4'],
    unidad_esperada: 'KG',
  },
  acero_no5: {
    tipo_db: 'material',
    keywords: ['VARILLA', 'R-42', 'No. 5'],
    unidad_esperada: 'KG',
  },
  acero_no6: {
    tipo_db: 'material',
    keywords: ['VARILLA', 'R-42', 'No. 6'],
    unidad_esperada: 'KG',
  },
  acero_no8: {
    tipo_db: 'material',
    keywords: ['VARILLA', 'R-42', 'No. 8'],
    unidad_esperada: 'KG',
  },

  malla_electrosoldada_6x6_10_10: {
    tipo_db: 'material',
    keywords: ['MALLA', '6x6', '10-10'],
    unidad_esperada: 'M2',
  },
  alambre_recocido: {
    tipo_db: 'material',
    keywords: ['ALAMBRE', 'RECOCIDO'],
    unidad_esperada: 'KG',
  },

  // ── Cimbras (basico_obra) ──────────────────────────
  cimbra_zapatas: {
    tipo_db: 'basico_obra',
    keywords: ['CIMBRA', 'ZAPATA'],
    unidad_esperada: 'M2',
  },
  cimbra_losa: {
    tipo_db: 'basico_obra',
    keywords: ['CIMBRA', 'LOSA'],
    unidad_esperada: 'M2',
  },
  cimbra_columnas: {
    tipo_db: 'basico_obra',
    keywords: ['CIMBRA'],
    exclude_keywords: ['LOSA', 'ZAPATA', 'TRA', 'MURO'],
    unidad_esperada: 'M2',
  },
  cimbra_muros: {
    tipo_db: 'basico_obra',
    keywords: ['CIMBRA', 'MURO'],
    unidad_esperada: 'M2',
  },
  cimbra_trabes: {
    tipo_db: 'basico_obra',
    keywords: ['CIMBRA', 'TRA'],
    unidad_esperada: 'M2',
  },

  // ── Excavacion y terracerias ───────────────────────
  excavacion_manual: {
    tipo_db: 'basico_obra',
    keywords: ['EXCAV', 'MANUAL'],
    unidad_esperada: 'M3',
  },
  excavacion_maquina: {
    tipo_db: 'basico_obra',
    keywords: ['EXCAV', 'MAQUIN'],
    unidad_esperada: 'M3',
  },
  plantilla_concreto_pobre: {
    tipo_db: 'basico_obra',
    keywords: ['PLANTILLA'],
    unidad_esperada: 'M2',
  },
  relleno_compactado: {
    tipo_db: 'basico_obra',
    keywords: ['RELLENO'],
    unidad_esperada: 'M3',
  },
  acarreo_material: {
    tipo_db: 'basico_obra',
    keywords: ['ACARREO'],
    unidad_esperada: 'M3',
  },

  // ── Tabique y block ────────────────────────────────
  tabique_rojo_14cm: {
    tipo_db: 'material',
    keywords: ['TABIQUE', 'ROJO', 'RECOCIDO'],
    exclude_keywords: ['MURO', 'CASTILLO', 'DALA', 'DAL'],
    unidad_esperada: 'PZA',
  },
  tabique_rojo_21cm: {
    tipo_db: 'material',
    keywords: ['TABIQUE', 'ROJO', 'RECOCIDO'],
    unidad_esperada: 'PZA',
  },
  tabique_rojo_28cm: {
    tipo_db: 'material',
    keywords: ['TABIQUE', 'ROJO', 'RECOCIDO'],
    unidad_esperada: 'PZA',
  },
  block_concreto_15cm: {
    tipo_db: 'material',
    keywords: ['BLOCK', 'CONCRETO', 'HUECO', '15x20x20'],
    unidad_esperada: 'PZA',
  },

  // ── Morteros (basico_obra o material) ──────────────
  mortero_1_4: {
    tipo_db: 'basico_obra',
    keywords: ['MORTERO', 'CEMENTO', 'ARENA', '1:4'],
    unidad_esperada: 'M3',
  },
  mortero_1_5: {
    tipo_db: 'basico_obra',
    keywords: ['MORTERO', 'CEMENTO', 'ARENA', '1:5'],
    unidad_esperada: 'M3',
  },
  mortero_1_6: {
    tipo_db: 'basico_obra',
    keywords: ['MORTERO', 'CEMENTO', 'ARENA', '1:6'],
    unidad_esperada: 'M3',
  },

  // ── Acabados ───────────────────────────────────────
  yeso_blanco: {
    tipo_db: 'material',
    keywords: ['YESO'],
    unidad_esperada: 'KG',
  },
  mezcla_aplanado: {
    tipo_db: 'basico_obra',
    keywords: ['APLANADO'],
    unidad_esperada: 'M2',
  },

  // ── Acero estructural ──────────────────────────────
  perfil_ipr: {
    tipo_db: 'material',
    keywords: ['PERFIL', 'IPR'],
    unidad_esperada: 'KG',
  },
  perfil_ptr: {
    tipo_db: 'material',
    keywords: ['PTR'],
    unidad_esperada: 'KG',
  },
  angulo_estructural: {
    tipo_db: 'material',
    keywords: ['ANGULO'],
    unidad_esperada: 'KG',
  },
  placa_acero: {
    tipo_db: 'material',
    keywords: ['PLACA', 'ACERO'],
    unidad_esperada: 'KG',
  },
  pintura_anticorrosiva: {
    tipo_db: 'material',
    keywords: ['PINTURA', 'ANTICORRO'],
    unidad_esperada: 'L',
  },
  pintura_esmalte: {
    tipo_db: 'material',
    keywords: ['PINTURA', 'ESMALTE'],
    unidad_esperada: 'L',
  },
  soldadura_electrodo: {
    tipo_db: 'material',
    keywords: ['SOLDADURA'],
    unidad_esperada: 'KG',
  },

  // ── Aluminio y vidrio ──────────────────────────────
  perfil_aluminio_kg: {
    tipo_db: 'material',
    keywords: ['ALUMINIO'],
    unidad_esperada: 'KG',
  },
  vidrio_6mm: {
    tipo_db: 'material',
    keywords: ['VIDRIO', 'CLARO'],
    unidad_esperada: 'M2',
  },
  vidrio_laminado: {
    tipo_db: 'material',
    keywords: ['VIDRIO'],
    unidad_esperada: 'M2',
  },
  hule_neopreno: {
    tipo_db: 'material',
    keywords: ['NEOPRENO'],
    unidad_esperada: 'ML',
  },
  tornilleria_aluminio: {
    tipo_db: 'material',
    keywords: ['TORNILLO'],
    unidad_esperada: 'PZA',
  },
  sellador_silicon: {
    tipo_db: 'material',
    keywords: ['SILICON'],
    unidad_esperada: 'PZA',
  },
  mampara_sanilock_m2: {
    tipo_db: 'material',
    keywords: ['SANILOCK'],
    unidad_esperada: 'M2',
  },

  // ── Tuberia acero ──────────────────────────────────
  tubo_redondo_acero: {
    tipo_db: 'material',
    keywords: ['TUBO', 'ACERO'],
    unidad_esperada: 'ML',
  },
  tubo_cuadrado_acero: {
    tipo_db: 'material',
    keywords: ['TUBO', 'CUADRADO'],
    unidad_esperada: 'ML',
  },
  platina_acero: {
    tipo_db: 'material',
    keywords: ['PLATINA'],
    unidad_esperada: 'ML',
  },

  // ── Tuberia cobre y PVC ────────────────────────────
  tubo_cobre_12plg: {
    tipo_db: 'material',
    keywords: ['TUBO', 'COBRE', '13'],
    unidad_esperada: 'ML',
  },
  tubo_cobre_34plg: {
    tipo_db: 'material',
    keywords: ['TUBO', 'COBRE', '19'],
    unidad_esperada: 'ML',
  },
  tubo_pvc_34plg: {
    tipo_db: 'material',
    keywords: ['TUBO', 'PVC', '25'],
    exclude_keywords: ['CONDUIT'],
    unidad_esperada: 'ML',
  },
  tubo_pvc_1plg: {
    tipo_db: 'material',
    keywords: ['TUBO', 'PVC', '32'],
    exclude_keywords: ['CONDUIT'],
    unidad_esperada: 'ML',
  },
  cople_cobre: {
    tipo_db: 'material',
    keywords: ['COPLE', 'COBRE'],
    unidad_esperada: 'PZA',
  },
  valvula_globo: {
    tipo_db: 'material',
    keywords: ['VALVULA'],
    unidad_esperada: 'PZA',
  },
  tinaco_rotoplas: {
    tipo_db: 'material',
    keywords: ['TINACO'],
    unidad_esperada: 'PZA',
  },

  // ── Electricos ─────────────────────────────────────
  cable_thw_calibre_12: {
    tipo_db: 'material',
    keywords: ['CABLE', 'THW', '12'],
    unidad_esperada: 'ML',
  },
  cable_thw_calibre_10: {
    tipo_db: 'material',
    keywords: ['CABLE', 'THW', '10'],
    unidad_esperada: 'ML',
  },
  cable_thw_calibre_8: {
    tipo_db: 'material',
    keywords: ['CABLE', 'THW', '8'],
    unidad_esperada: 'ML',
  },
  conduit_emt_34plg: {
    tipo_db: 'material',
    keywords: ['CONDUIT', 'GALVANIZADO', '25'],
    unidad_esperada: 'ML',
  },
  conduit_pvc_34plg: {
    tipo_db: 'material',
    keywords: ['CONDUIT', 'PVC', '25'],
    unidad_esperada: 'ML',
  },
  caja_registro_elect: {
    tipo_db: 'material',
    keywords: ['CAJA', 'CUADRADA'],
    unidad_esperada: 'PZA',
  },
  condulet_elect: {
    tipo_db: 'material',
    keywords: ['CONDULET'],
    unidad_esperada: 'PZA',
  },
  cinta_aislante: {
    tipo_db: 'material',
    keywords: ['CINTA'],
    unidad_esperada: 'PZA',
  },

  // ── Mano de obra (busqueda exacta por clave) ──────
  '1A1P': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1A1P', unidad_esperada: 'JOR' },
  '1F1A': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1F1A', unidad_esperada: 'JOR' },
  '1H1A': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1H1A', unidad_esperada: 'JOR' },
  '1S1E': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1S1E', unidad_esperada: 'JOR' },
  '1C1A': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1C1A', unidad_esperada: 'JOR' },
  '1P1E': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1P1E', unidad_esperada: 'JOR' },
  '1E1E': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1E1E', unidad_esperada: 'JOR' },
  '1CO1A': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1CO1A', unidad_esperada: 'JOR' },
  '1A1E': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1A1E', unidad_esperada: 'JOR' },
  '1P': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1P', unidad_esperada: 'JOR' },
  '1A': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1A', unidad_esperada: 'JOR' },
  '1P1A': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1P1A', unidad_esperada: 'JOR' },
  '1Y1A': { tipo_db: 'mano_obra', exact_field: 'clave_neodata', exact_value: '1Y1A', unidad_esperada: 'JOR' },
};

export default INSUMO_METADATA;

export function getInsumoMeta(tipo: string): InsumoMeta | undefined {
  return INSUMO_METADATA[tipo];
}
