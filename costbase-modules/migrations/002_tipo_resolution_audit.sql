-- Sign-off query: run after deploying resolver + metadata fixes.
-- Lists each registered tipo's best DB match using the same keyword rules as the app.
-- Review nombre_db, insumo_tipo, unidad_db vs expected.

-- Example manual check for a single tipo (tubo_redondo_acero):
-- SELECT id, nombre, tipo, unidad, LENGTH(nombre)
-- FROM insumos
-- WHERE activo AND tipo = 'material'
--   AND nombre ILIKE '%TUBO%' AND nombre ILIKE '%REDONDO%' AND nombre ILIKE '%ACERO%'
--   AND nombre NOT ILIKE '%CADWELD%' AND nombre NOT ILIKE '%MOLDE%'
-- ORDER BY LENGTH(nombre) ASC LIMIT 5;

-- Duplicate canonical prices (should return 0 rows after 001_canonical_prices.sql):
SELECT insumo_id, region_id, COUNT(*) AS n
FROM precios
WHERE canonical = true
GROUP BY insumo_id, region_id
HAVING COUNT(*) > 1;

-- Insumos with multiple tiers still in history (informational):
SELECT insumo_id, region_id, COUNT(DISTINCT COALESCE(tier, '_default')) AS tier_count
FROM precios
GROUP BY insumo_id, region_id
HAVING COUNT(DISTINCT COALESCE(tier, '_default')) > 1
ORDER BY tier_count DESC
LIMIT 20;
