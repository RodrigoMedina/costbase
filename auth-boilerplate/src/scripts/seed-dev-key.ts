import { createHash, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`DELETE FROM apikey WHERE name = 'Development seed key'`;

  const rawKey = "cb_dev_" + randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(rawKey).digest("base64url");

  await sql`
    INSERT INTO apikey (id, config_id, name, start, prefix, key, reference_id, enabled)
    VALUES (
      gen_random_uuid()::text,
      'default',
      'Development seed key',
      ${rawKey.slice(0, 8)},
      'cb_dev',
      ${hash},
      'seed-dev-user',
      true
    )
  `;

  console.log("Dev API key created:");
  console.log(rawKey);
  console.log("");
  console.log("Add to costbase-modules/.env:");
  console.log(`COSTBASE_API_TOKEN=${rawKey}`);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
