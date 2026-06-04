-- CostBase: canonical price per (insumo_id, region_id)
-- Run manually on Neon (DATABASE_URL) before deploying resolver changes that use precios_actuales.
--
-- Rule: one canonical row per (insumo_id, region_id) = latest fecha, tiebreak lowest precio (conservative), then id.

BEGIN;

ALTER TABLE precios ADD COLUMN IF NOT EXISTS canonical BOOLEAN NOT NULL DEFAULT false;

-- Reset flags
UPDATE precios SET canonical = false;

-- Mark winners
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY insumo_id, region_id
           ORDER BY fecha DESC, precio ASC, id ASC
         ) AS rn
  FROM precios
)
UPDATE precios p
SET canonical = true
FROM ranked r
WHERE p.id = r.id AND r.rn = 1;

-- Enforce at most one canonical price per insumo+region
CREATE UNIQUE INDEX IF NOT EXISTS idx_precios_canonical_unique
  ON precios (insumo_id, region_id)
  WHERE canonical = true;

DROP VIEW IF EXISTS precios_actuales;

CREATE VIEW precios_actuales AS
  SELECT
    insumo_id,
    region_id,
    tier,
    precio,
    moneda,
    fuente_tipo,
    confianza,
    fecha
  FROM precios
  WHERE canonical = true;

COMMIT;

-- Verification (optional):
-- SELECT insumo_id, region_id, COUNT(*) FROM precios WHERE canonical GROUP BY 1,2 HAVING COUNT(*) > 1;
