import { Pool } from 'pg';
import { InsumoRequerido, ResultadoModulo, ResultadoConPrecios } from '../types/module.types';

const TIPO_QUERIES: Record<string, string> = {
  'concreto_fc150': `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%150%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'concreto_fc200': `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%200%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'concreto_fc250': `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%250%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'concreto_fc300': `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%300%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'concreto_pobre': `WHERE tipo='material' AND nombre ILIKE '%concreto%' AND nombre ILIKE '%pobre%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'acero_no3': `WHERE tipo='material' AND nombre ILIKE '%varilla%' AND nombre ILIKE '%R-42%' AND nombre ILIKE '%3/8%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no4': `WHERE tipo='material' AND nombre ILIKE '%varilla%' AND nombre ILIKE '%R-42%' AND nombre ILIKE '%1/2%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no5': `WHERE tipo='material' AND nombre ILIKE '%varilla%' AND nombre ILIKE '%R-42%' AND nombre ILIKE '%5/8%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no6': `WHERE tipo='material' AND nombre ILIKE '%varilla%' AND nombre ILIKE '%R-42%' AND (nombre ILIKE '%3/4%' OR nombre ILIKE '%no. 6%') ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acero_no8': `WHERE tipo='material' AND nombre ILIKE '%varilla%' AND nombre ILIKE '%R-42%' AND (nombre ILIKE '%1%' OR nombre ILIKE '%no. 8%') ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'malla_electrosoldada_6x6_10_10': `WHERE tipo='material' AND nombre ILIKE '%malla%6x6%' AND nombre ILIKE '%10-10%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'alambre_recocido': `WHERE tipo='material' AND nombre ILIKE '%alambre%recocido%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'cimbra_zapatas': `WHERE tipo='basico_obra' AND nombre ILIKE '%cimbra%zapata%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_losa': `WHERE tipo='basico_obra' AND nombre ILIKE '%cimbra%losa%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_columnas': `WHERE tipo='basico_obra' AND nombre ILIKE '%cimbra%' AND (nombre ILIKE '%muro%' OR nombre ILIKE '%pilote%') ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_muros': `WHERE tipo='basico_obra' AND nombre ILIKE '%cimbra%muro%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cimbra_trabes': `WHERE tipo='basico_obra' AND nombre ILIKE '%cimbra%trabe%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'excavacion_manual': `WHERE tipo='basico_obra' AND nombre ILIKE '%excav%' AND nombre ILIKE '%manual%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'excavacion_maquina': `WHERE tipo='basico_obra' AND nombre ILIKE '%excav%' AND nombre ILIKE '%maquin%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'plantilla_concreto_pobre': `WHERE tipo='basico_obra' AND nombre ILIKE '%plantilla%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'relleno_compactado': `WHERE tipo='basico_obra' AND nombre ILIKE '%relleno%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'acarreo_material': `WHERE tipo='basico_obra' AND nombre ILIKE '%acarreo%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'tabique_rojo_14cm': `WHERE tipo='basico_obra' AND nombre ILIKE '%tabique%' AND nombre ILIKE '%14%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tabique_rojo_21cm': `WHERE tipo='basico_obra' AND nombre ILIKE '%tabique%' AND nombre ILIKE '%21%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tabique_rojo_28cm': `WHERE tipo='basico_obra' AND nombre ILIKE '%tabique%' AND nombre ILIKE '%28%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'block_concreto_15cm': `WHERE tipo='material' AND nombre ILIKE '%block%' AND nombre ILIKE '%15%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'mortero_1_4': `WHERE (tipo='basico_obra' OR tipo='material') AND nombre ILIKE '%mortero%1:4%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'mortero_1_5': `WHERE (tipo='basico_obra' OR tipo='material') AND nombre ILIKE '%mortero%1:5%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'mortero_1_6': `WHERE (tipo='basico_obra' OR tipo='material') AND nombre ILIKE '%mortero%1:6%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'yeso_blanco': `WHERE tipo='material' AND nombre ILIKE '%yeso%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'mezcla_aplanado': `WHERE tipo='basico_obra' AND nombre ILIKE '%aplanado%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'perfil_ipr': `WHERE tipo='material' AND nombre ILIKE '%perfil%ipr%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'perfil_ptr': `WHERE tipo='material' AND nombre ILIKE '%ptr%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'angulo_estructural': `WHERE tipo='material' AND nombre ILIKE '%angulo%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'placa_acero': `WHERE tipo='material' AND nombre ILIKE '%placa%acero%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'pintura_anticorrosiva': `WHERE tipo='material' AND nombre ILIKE '%pintura%anticorro%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'pintura_esmalte': `WHERE tipo='material' AND nombre ILIKE '%pintura%esmalte%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'soldadura_electrodo': `WHERE tipo='material' AND nombre ILIKE '%soldadura%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'perfil_aluminio_kg': `WHERE tipo='material' AND (nombre ILIKE '%perfil%aluminio%' OR nombre ILIKE '%aluminio%valsa%' OR nombre ILIKE '%aluminio%cuprum%') ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'vidrio_6mm': `WHERE tipo='material' AND nombre ILIKE '%vidrio%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'vidrio_laminado': `WHERE tipo='material' AND nombre ILIKE '%vidrio%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'hule_neopreno': `WHERE tipo='material' AND (nombre ILIKE '%neopreno%' OR (nombre ILIKE '%hule%' AND NOT nombre ILIKE '%fibra%')) ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tornilleria_aluminio': `WHERE tipo='material' AND nombre ILIKE '%tornillo%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'sellador_silicon': `WHERE tipo='material' AND (nombre ILIKE '%silicon%cartucho%' OR nombre ILIKE '%sellador%silicon%') ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'mampara_sanilock_m2': `WHERE tipo='material' AND nombre ILIKE '%sanilock%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'tubo_redondo_acero': `WHERE tipo='material' AND nombre ILIKE '%tubo%' AND nombre ILIKE '%acero%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tubo_cuadrado_acero': `WHERE tipo='material' AND nombre ILIKE '%tubo%cuadrado%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'platina_acero': `WHERE tipo='material' AND nombre ILIKE '%platina%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'tubo_cobre_12plg': `WHERE tipo='material' AND nombre ILIKE '%tubo%cobre%' AND nombre ILIKE '%13%mm%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tubo_cobre_34plg': `WHERE tipo='material' AND nombre ILIKE '%tubo%cobre%' AND nombre ILIKE '%19%mm%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tubo_pvc_34plg': `WHERE tipo='material' AND nombre ILIKE '%tubo%pvc%' AND nombre ILIKE '%25%mm%' AND nombre NOT ILIKE '%conduit%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tubo_pvc_1plg': `WHERE tipo='material' AND nombre ILIKE '%tubo%pvc%' AND nombre ILIKE '%32%mm%' AND nombre NOT ILIKE '%conduit%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cople_cobre': `WHERE tipo='material' AND nombre ILIKE '%cople%cobre%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'valvula_globo': `WHERE tipo='material' AND nombre ILIKE '%valvula%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'tinaco_rotoplas': `WHERE tipo='material' AND nombre ILIKE '%tinaco%rotoplas%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  'cable_thw_calibre_12': `WHERE tipo='material' AND nombre ILIKE '%cable%thw%' AND nombre ILIKE '%12%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cable_thw_calibre_10': `WHERE tipo='material' AND nombre ILIKE '%cable%thw%' AND nombre ILIKE '%10%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cable_thw_calibre_8': `WHERE tipo='material' AND nombre ILIKE '%cable%thw%' AND nombre ILIKE '%8%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'conduit_emt_34plg': `WHERE tipo='material' AND nombre ILIKE '%tubo%conduit%galvanizado%' AND nombre ILIKE '%25%mm%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'conduit_pvc_34plg': `WHERE tipo='material' AND nombre ILIKE '%tubo%conduit%pvc%' AND nombre ILIKE '%25%mm%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'caja_registro_elect': `WHERE tipo='material' AND nombre ILIKE '%caja%cuadrada%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'condulet_elect': `WHERE tipo='material' AND nombre ILIKE '%condulet%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,
  'cinta_aislante': `WHERE tipo='material' AND nombre ILIKE '%cinta%scotch%' ORDER BY LENGTH(nombre) ASC LIMIT 1`,

  '1A1P': `WHERE clave_neodata = '1A1P' AND tipo = 'mano_obra'`,
  '1F1A': `WHERE clave_neodata = '1F1A' AND tipo = 'mano_obra'`,
  '1H1A': `WHERE clave_neodata = '1H1A' AND tipo = 'mano_obra'`,
  '1S1E': `WHERE clave_neodata = '1S1E' AND tipo = 'mano_obra'`,
  '1C1A': `WHERE clave_neodata = '1C1A' AND tipo = 'mano_obra'`,
  '1P1E': `WHERE clave_neodata = '1P1E' AND tipo = 'mano_obra'`,
  '1E1E': `WHERE clave_neodata = '1E1E' AND tipo = 'mano_obra'`,
  '1CO1A': `WHERE clave_neodata = '1CO1A' AND tipo = 'mano_obra'`,
  '1A1E': `WHERE clave_neodata = '1A1E' AND tipo = 'mano_obra'`,
  '1P': `WHERE clave_neodata = '1P' AND tipo = 'mano_obra'`,
  '1A': `WHERE clave_neodata = '1A' AND tipo = 'mano_obra'`,
  '1P1A': `WHERE clave_neodata = '1P1A' AND tipo = 'mano_obra'`,
  '1Y1A': `WHERE clave_neodata = '1Y1A' AND tipo = 'mano_obra'`,
};

export async function resolver(
  resultado: ResultadoModulo,
  region_id: number,
  pool: Pool
): Promise<ResultadoConPrecios> {
  const insumos_con_precio = [];
  const totales = { materiales: 0, mano_obra: 0, maquinaria: 0, costo_directo: 0 };

  for (const insumo of resultado.insumos) {
    const query_fragment = TIPO_QUERIES[insumo.tipo];

    if (!query_fragment) {
      console.warn(`RESOLVER: No query for tipo="${insumo.tipo}"`);
      continue;
    }

    const insumo_row = await pool.query(
      `SELECT i.id, i.nombre, i.tipo FROM insumos i ${query_fragment}`
    );

    if (insumo_row.rows.length === 0) {
      console.warn(`RESOLVER: No DB insumo for tipo="${insumo.tipo}"`);
      continue;
    }

    const { id: insumo_id, nombre: nombre_db, tipo: tipo_db } = insumo_row.rows[0];

    const precio_row = await pool.query(
      `SELECT precio, fuente_tipo, confianza
       FROM precios
       WHERE insumo_id = $1 AND region_id = $2
       ORDER BY fecha DESC LIMIT 1`,
      [insumo_id, region_id]
    );

    let precio = 0, fuente_precio = 'not_found', confianza = 0;
    if (precio_row.rows.length > 0) {
      precio = parseFloat(precio_row.rows[0].precio);
      fuente_precio = precio_row.rows[0].fuente_tipo;
      confianza = parseFloat(precio_row.rows[0].confianza);
    } else {
      const fallback = await pool.query(
        `SELECT precio FROM precios WHERE insumo_id = $1 AND region_id = 1
         ORDER BY fecha DESC LIMIT 1`,
        [insumo_id]
      );
      if (fallback.rows.length > 0) {
        precio = parseFloat(fallback.rows[0].precio);
        fuente_precio = 'neodata_seed_r1_fallback';
        confianza = 0.5;
      }
    }

    const cantidad_total = insumo.cantidad * (1 + (insumo.desperdicio ?? 0));
    const subtotal = cantidad_total * precio;

    insumos_con_precio.push({
      ...insumo,
      cantidad_total,
      insumo_id,
      nombre_db,
      precio_unitario: precio,
      subtotal,
      fuente_precio,
      confianza,
    });

    if (tipo_db === 'mano_obra') totales.mano_obra += subtotal;
    else if (tipo_db === 'maquinaria') totales.maquinaria += subtotal;
    else totales.materiales += subtotal;
    totales.costo_directo += subtotal;
  }

  return {
    ...resultado,
    region_id,
    insumos_con_precio,
    totales,
  };
}
