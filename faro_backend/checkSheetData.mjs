import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: './service_account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEET_ID = '1xw_x-BE9cQ_9VNXjGOKYSDkbLcZNaiYzSVKwuCb4wqU';

const sheets = google.sheets({ version: 'v4', auth });
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'Records!A1:AV200',
});
const rows = res.data.values || [];
const headers = rows[1]; // row 2 = headers

const targets = ['Lagos'];

for (const target of targets) {
  const row = rows.find((r, i) => i >= 2 && r[3] === target);
  if (!row) { console.log(`\n${target}: NOT FOUND`); continue; }

  console.log(`\n=== ${row[3]}, ${row[5]} ===`);
  let filled = 0, empty = 0;
  headers.forEach((h, j) => {
    const val = (row[j] || '').trim();
    if (val) {
      filled++;
      console.log(`  ✓ [${h}]: ${val.slice(0, 70)}`);
    } else {
      empty++;
      console.log(`  ✗ [${h}]: EMPTY`);
    }
  });
  console.log(`\n  Filled: ${filled} / ${headers.length} columns  |  Empty: ${empty}`);
}
