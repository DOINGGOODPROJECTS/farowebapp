import { db }                    from "../db.js";
import { embedAndUpsert, ensureCollection } from "./embeddings.js";

console.log("Syncing all MySQL records → Qdrant...\n");

await ensureCollection();

const [rows] = await db.query(`
  SELECT id, category, title, city, state, country,
         description, data, confidence_level, status
  FROM   faro_dataset_records
  WHERE  status != 'rejected'
  ORDER  BY created_at ASC
`);

console.log(`Records to sync: ${rows.length}\n`);

let ok = 0;
let failed = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  try {
    await embedAndUpsert(row.id, row);
    ok++;
    if (ok % 10 === 0) console.log(`  ${ok}/${rows.length} synced...`);

    // Respect OpenAI embeddings rate limit
    await new Promise((r) => setTimeout(r, 150));
  } catch (err) {
    console.error(`  Failed [${row.id}]: ${err.message}`);
    failed++;
  }
}

console.log(`\nSync complete — ok: ${ok}, failed: ${failed}`);
process.exit(0);
