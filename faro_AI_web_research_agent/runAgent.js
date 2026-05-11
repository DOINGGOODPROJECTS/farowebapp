import { fetchPageText }       from "./fetchPage.js";
import { extractRecordFromText } from "./extractRecord.js";
import { saveRecord }            from "./saveRecord.js";
import { normalizeLocation }     from "./normalizeLocation.js";
import { embedAndUpsert }        from "./rag/embeddings.js";

const url = process.argv[2];

if (!url) {
  console.error("Usage: npm run agent -- https://example.com");
  process.exit(1);
}

try {
  console.log("1. Fetching page...");
  const page = await fetchPageText(url);

  console.log("2. Extracting dataset record...");
  let record = await extractRecordFromText({
    pageTitle: page.title,
    text:      page.text,
    sourceUrl: url,
  });

  console.log("3. Normalizing location...");
  record = normalizeLocation(record);

  console.log("4. Saving to MySQL...");
  const id = await saveRecord(record, page.text);

  if (!id) {
    console.log("No record saved.");
    process.exit(0);
  }

  console.log("5. Embedding in Qdrant...");
  await embedAndUpsert(id, record);

  console.log("\nDone.");
  console.log("Record ID:", id);
  console.log(JSON.stringify(record, null, 2));

  process.exit(0);
} catch (err) {
  console.error("Agent failed:", err.message);
  process.exit(1);
}
