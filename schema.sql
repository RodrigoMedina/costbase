-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Regions (11 Mexican pricing zones)
CREATE TABLE regiones (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL,
  estados TEXT
);

INSERT INTO regiones (id, nombre, estados) VALUES
  (1,  'Valle de México',  'CDMX, Estado de México, Hidalgo'),
  (2,  'Norte',            'Chihuahua, Sonora, Sinaloa, Durango'),
  (3,  'Noreste',          'Nuevo León, Coahuila, Tamaulipas'),
  (4,  'Noroeste',         'Baja California, Baja California Sur'),
  (5,  'Occidente',        'Jalisco, Colima, Nayarit, Aguascalientes'),
  (6,  'Bajío',            'Guanajuato, Querétaro, Michoacán, San Luis Potosí'),
  (7,  'Centro-Sur',       'Morelos, Guerrero, Puebla, Tlaxcala'),
  (8,  'Sur',              'Oaxaca, Chiapas'),
  (9,  'Sureste',          'Veracruz, Tabasco'),
  (10, 'Península',        'Yucatán, Campeche, Quintana Roo'),
  (11, 'Pacífico Centro',  'Michoacán Costa, Guerrero Norte');

-- 2. Partidas (hierarchical work taxonomy, deduplicated across tiers)
CREATE TABLE partidas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata TEXT,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  padre_id      UUID REFERENCES partidas(id),
  nivel         INT NOT NULL DEFAULT 1,
  path          TEXT,
  orden         INT DEFAULT 0,
  tiers         TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_partidas_padre ON partidas(padre_id);
CREATE INDEX idx_partidas_path  ON partidas(path);

-- 3. Insumos (input catalog)
CREATE TABLE insumos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata    TEXT,
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  unidad           TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('material','mano_obra','maquinaria','herramienta','subcontrato','basico_obra')),
  partida_id       UUID REFERENCES partidas(id),
  familia          TEXT,
  especificaciones JSONB,
  tags             TEXT[],
  embedding        vector(1536),
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insumos_tipo      ON insumos(tipo);
CREATE INDEX idx_insumos_partida   ON insumos(partida_id);
CREATE INDEX idx_insumos_nombre    ON insumos(nombre);

-- 4. Conceptos (unit prices)
CREATE TABLE conceptos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata TEXT,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  unidad        TEXT NOT NULL,
  partida_id    UUID REFERENCES partidas(id),
  tier          TEXT[],
  embedding     vector(1536),
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conceptos_partida ON conceptos(partida_id);
CREATE INDEX idx_conceptos_nombre  ON conceptos(nombre);

-- 5. Matrices (unit price composition)
CREATE TABLE matrices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto_id UUID NOT NULL REFERENCES conceptos(id) ON DELETE CASCADE,
  insumo_id   UUID NOT NULL REFERENCES insumos(id),
  cantidad    DECIMAL(14, 6) NOT NULL,
  desperdicio DECIMAL(5, 4) DEFAULT 0,
  nivel       INT DEFAULT 1,
  orden       INT DEFAULT 0,
  UNIQUE(concepto_id, insumo_id, nivel)
);

CREATE INDEX idx_matrices_concepto ON matrices(concepto_id);
CREATE INDEX idx_matrices_insumo   ON matrices(insumo_id);

-- 6. Prices (append-only, for trend analysis)
CREATE TABLE precios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id   UUID NOT NULL REFERENCES insumos(id),
  region_id   INT  NOT NULL REFERENCES regiones(id),
  tier        TEXT,
  precio      DECIMAL(14, 4) NOT NULL,
  moneda      TEXT NOT NULL DEFAULT 'MXN',
  fuente_url  TEXT,
  fuente_tipo TEXT NOT NULL CHECK (fuente_tipo IN ('scraping','api_oficial','cotizacion','manual','neodata_seed')),
  confianza   DECIMAL(3, 2) CHECK (confianza >= 0 AND confianza <= 1),
  fecha       DATE NOT NULL,
  canonical   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_precios_insumo    ON precios(insumo_id);
CREATE INDEX idx_precios_region    ON precios(region_id);
CREATE INDEX idx_precios_tier      ON precios(tier);
CREATE INDEX idx_precios_fecha     ON precios(fecha DESC);

CREATE UNIQUE INDEX idx_precios_canonical_unique
  ON precios (insumo_id, region_id)
  WHERE canonical = true;

-- One current price per insumo per region (see migrations/001_canonical_prices.sql)
CREATE VIEW precios_actuales AS
  SELECT insumo_id, region_id, tier, precio, moneda,
    fuente_tipo, confianza, fecha
  FROM precios
  WHERE canonical = true;

-- 7. Intelimats catalog (Phase 3)
CREATE TABLE intelimats_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_neodata TEXT,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  parametros    JSONB,
  conceptos_rel TEXT[],
  implementado  BOOLEAN DEFAULT false,
  notas         TEXT
);
