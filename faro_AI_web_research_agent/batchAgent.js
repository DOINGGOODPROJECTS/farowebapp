import { readFileSync } from "fs";
import { fetchPageText }        from "./fetchPage.js";
import { extractRecordFromText } from "./extractRecord.js";
import { saveRecord }            from "./saveRecord.js";
import { normalizeLocation }     from "./normalizeLocation.js";
import { embedAndUpsert, ensureCollection } from "./rag/embeddings.js";

const CONCURRENCY = 5;

const urlsFile = process.argv[2] || "urls.json";

let urls;
try {
  urls = JSON.parse(readFileSync(urlsFile, "utf-8"));
} catch {
  console.error(`Cannot read ${urlsFile}. Create it with an array of URLs.`);
  process.exit(1);
}

console.log(`Processing ${urls.length} URLs from ${urlsFile} (concurrency: ${CONCURRENCY})\n`);

await ensureCollection();

async function processUrl(url, index) {
  console.log(`[${index + 1}/${urls.length}] ${url}`);
  try {
    const page = await fetchPageText(url);

    let record = await extractRecordFromText({
      pageTitle: page.title,
      text:      page.text,
      sourceUrl: url,
    });

    record = normalizeLocation(record);

    const id = await saveRecord(record, page.text);

    if (id) {
      await embedAndUpsert(id, record);
      console.log(`  [${index + 1}] Saved & embedded: ${id}`);
      return "saved";
    } else {
      console.log(`  [${index + 1}] Skipped`);
      return "skipped";
    }
  } catch (err) {
    console.error(`  [${index + 1}] Failed: ${err.message}`);
    return "failed";
  }
}

let saved = 0, skipped = 0, failed = 0;

for (let i = 0; i < urls.length; i += CONCURRENCY) {
  const batch = urls.slice(i, i + CONCURRENCY);
  const results = await Promise.all(
    batch.map((url, j) => processUrl(url, i + j))
  );
  for (const r of results) {
    if (r === "saved") saved++;
    else if (r === "skipped") skipped++;
    else failed++;
  }
}

console.log(`\nBatch complete — saved: ${saved}, skipped: ${skipped}, failed: ${failed}`);
process.exit(0);
