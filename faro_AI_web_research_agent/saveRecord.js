import { db } from "./db.js";
import { v4 as uuidv4 } from "uuid";
import { isUSLocation } from "./usCities.js";
import { appendRowToSheet } from "./googleSheets.js";

export async function saveRecord(record, rawText) {
  if (record.status === "rejected") {
    console.log("  Skipped: AI marked as rejected.");
    return null;
  }

  if (!isUSLocation(record)) {
    console.log("  Skipped: not a valid US city/state.");
    return null;
  }

  const id = uuidv4();

  await db.query(
    `INSERT INTO faro_dataset_records
     (id, category, title, location, city, state, country,
      description, data, source_url, source_name,
      confidence_score, confidence_level, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      record.category,
      record.title,
      record.location,
      record.city,
      record.state,
      record.country,
      record.description,
      JSON.stringify(record.data || {}),
      record.source_url,
      record.source_name,
      record.confidence_score,
      record.confidence_level,
      record.status,
    ]
  );

  await db.query(
    `INSERT INTO faro_source_logs (id, record_id, source_url, raw_text)
     VALUES (?, ?, ?, ?)`,
    [uuidv4(), id, record.source_url, rawText]
  );

  try {
    await appendRowToSheet(id, record);
  } catch (err) {
    console.warn("  Google Sheets sync skipped:", err.message);
  }

  return id;
}
