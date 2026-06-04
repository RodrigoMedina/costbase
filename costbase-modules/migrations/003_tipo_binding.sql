-- Deterministic tipo → insumo bindings (authoring source: src/resolver/bindings.json)
-- Runtime resolver reads bindings.json; this table supports audit, overrides, and future DB-only deploys.

CREATE TABLE IF NOT EXISTS tipo_binding (
  tipo TEXT PRIMARY KEY,
  insumo_id UUID NOT NULL REFERENCES insumos(id),
  price_divisor NUMERIC,
  pieza_longitud_m NUMERIC,
  expected_familia TEXT,
  forbidden_nombre_contains TEXT[],
  source TEXT NOT NULL DEFAULT 'imported',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tipo_binding_insumo ON tipo_binding(insumo_id);

COMMENT ON TABLE tipo_binding IS 'Authoritative tipo→insumo map; seed from bindings.json via scripts/seed-tipo-binding.ts';
