# Database migrations (manual)

Run against your Neon Postgres (`DATABASE_URL`) in order:

1. **`001_canonical_prices.sql`** — Required before the updated resolver uses `precios_actuales`. Marks one canonical price per `(insumo_id, region_id)` and rebuilds the view.

2. **`002_tipo_resolution_audit.sql`** — Optional verification queries after metadata/resolver deploy.

```bash
psql "$DATABASE_URL" -f costbase-modules/migrations/001_canonical_prices.sql
psql "$DATABASE_URL" -f costbase-modules/migrations/002_tipo_resolution_audit.sql
```

Then redeploy the API (`npm run build` in `costbase-modules`).
