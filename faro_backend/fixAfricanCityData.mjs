import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({ keyFile: './service_account.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = '1xw_x-BE9cQ_9VNXjGOKYSDkbLcZNaiYzSVKwuCb4wqU';

const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const recordsTab = meta.data.sheets.find(s => s.properties.title === 'Records');
const sheetId = recordsTab.properties.sheetId;

// Delete duplicate rows — must delete from BOTTOM to TOP to avoid row shifting
const dupeRows = [44, 42, 39, 36, 35, 32, 29]; // bottom to top

const requests = dupeRows.map(rowNum => ({
  deleteDimension: {
    range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum }
  }
}));

await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
console.log(`Deleted ${dupeRows.length} duplicate rows: ${dupeRows.join(', ')}`);

// Verify
const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Records!A3:F100' });
const rows = res.data.values || [];
const cities = rows.filter(r => r[3]).map(r => `Row ${rows.indexOf(r)+3}: ${r[3]}, ${r[5]}`);
console.log(`\nRemaining rows: ${cities.length}`);
cities.forEach(c => console.log(' ', c));
