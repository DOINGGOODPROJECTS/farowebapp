import { readFileSync } from "fs";
import { fetchPageText }        from "./fetchPage.js";
import { extractRecordFromText } from "./extractRecord.js";
import { saveRecord }            from "./saveRecord.js";
import { normalizeLocation }     from "./normalizeLocation.js";
import { embedAndUpsert }        from "./rag/embeddings.js";

const urlsFile = process.argv[2] || "urls.json";

let urls;
try {
  urls = JSON.parse(readFileSync(urlsFile, "utf-8"));
} catch {
  console.error(`Cannot read ${urlsFile}. Create it with an array of URLs.`);
  process.exit(1);
}

console.log(`Processing ${urls.length} URLs from ${urlsFile}\n`);

let saved = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  console.log(`[${i + 1}/${urls.length}] ${url}`);

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
      console.log(`  Saved & embedded: ${id}`);
      saved++;
    } else {
      console.log(`  Skipped`);
      skipped++;
    }
  } catch (err) {
    console.error(`  Failed: ${err.message}`);
    failed++;
  }

  // 2-second pause between requests to avoid rate limits
  if (i < urls.length - 1) {
    await new Promise((r) => setTimeout(r, 2000));
  }
}

console.log(`\nBatch complete — saved: ${saved}, skipped: ${skipped}, failed: ${failed}`);
process.exit(0);
