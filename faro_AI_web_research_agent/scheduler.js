import cron from "node-cron";
import { db }                    from "./db.js";
import { fetchPageText }         from "./fetchPage.js";
import { extractRecordFromText } from "./extractRecord.js";
import { normalizeLocation }     from "./normalizeLocation.js";
import { embedAndUpsert }        from "./rag/embeddings.js";

async function refreshStaleRecords() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Starting stale-record refresh...`);

  // Fetch up to 20 records not verified in the past 7 days
  const [rows] = await db.query(`
    SELECT id, source_url
    FROM   faro_dataset_records
    WHERE  last_verified < NOW() - INTERVAL 7 DAY
    AND    status        != 'rejected'
    ORDER  BY last_verified ASC
    LIMIT  20
  `);

  console.log(`  Found ${rows.length} stale records`);

  for (const row of rows) {
    try {
      console.log(`  Refreshing ${row.id} — ${row.source_url}`);

      const page = await fetchPageText(row.source_url);
      let record = await extractRecordFromText({
        pageTitle: page.title,
        text:      page.text,
        sourceUrl: row.source_url,
      });
      record = normalizeLocation(record);

      if (record.status === "rejected") {
        await db.query(
          `UPDATE faro_dataset_records
           SET    status = 'expired', last_verified = NOW()
           WHERE  id = ?`,
          [row.id]
        );
        console.log(`    Marked expired`);
        continue;
      }

      await db.query(
        `UPDATE faro_dataset_records
         SET    title            = ?,
                description      = ?,
                data             = ?,
                confidence_score = ?,
                confidence_level = ?,
                status           = ?,
                last_verified    = NOW()
         WHERE  id = ?`,
        [
          record.title,
          record.description,
          JSON.stringify(record.data || {}),
          record.confidence_score,
          record.confidence_level,
          record.status,
          row.id,
        ]
      );

      await embedAndUpsert(row.id, record);
      console.log(`    Refreshed OK`);

      // Polite delay between requests
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`    Failed: ${err.message}`);
    }
  }

  console.log(`[${new Date().toISOString()}] Refresh cycle complete\n`);
}

// Run every day at 2:00 AM
cron.schedule("0 2 * * *", refreshStaleRecords);

// Run once immediately on startup
await refreshStaleRecords();

console.log("Scheduler running — Ctrl+C to stop");
