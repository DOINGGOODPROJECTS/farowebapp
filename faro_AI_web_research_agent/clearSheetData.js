/**
 * clearSheetData.js
 * Deletes all data rows in the Google Sheet (row 3 onwards),
 * leaving the two header rows (GROUP_ROW and HEADER_ROW) intact.
 *
 * Usage: node clearSheetData.js
 */

import { google } from "googleapis";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { getAuthClient } from "./googleAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config();

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
if (!spreadsheetId) {
  console.error("GOOGLE_SHEET_ID not set in .env.local");
  process.exit(1);
}

const auth   = getAuthClient();
const sheets = google.sheets({ version: "v4", auth });

// 1. Find out how many rows currently exist
const meta = await sheets.spreadsheets.get({ spreadsheetId });
const sheet = meta.data.sheets.find(s => s.properties.title === "Records");
if (!sheet) {
  console.error("Sheet tab 'Records' not found.");
  process.exit(1);
}

const totalRows = sheet.properties.gridProperties.rowCount;
console.log(`Sheet has ${totalRows} total rows (grid capacity).`);

// 2. Read how many rows actually have data
const dataRange = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: "Records!A1:A",
});
const dataRows = (dataRange.data.values || []).length;
console.log(`Rows with data: ${dataRows} (rows 1–${dataRows})`);

if (dataRows <= 2) {
  console.log("Nothing to clear — only header rows exist.");
  process.exit(0);
}

// 3. Clear everything from row 3 downward
const clearRange = `Records!A3:AZ${dataRows}`;
await sheets.spreadsheets.values.clear({
  spreadsheetId,
  range: clearRange,
});

console.log(`Cleared rows 3–${dataRows}. Header rows 1 & 2 preserved.`);
console.log(`Sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
