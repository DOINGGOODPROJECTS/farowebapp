import { google } from 'googleapis';
import { randomUUID as uuidv4 } from 'crypto';

const auth = new google.auth.GoogleAuth({
  keyFile: './service_account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEET_ID = '1xw_x-BE9cQ_9VNXjGOKYSDkbLcZNaiYzSVKwuCb4wqU';

const AFRICAN = [
  ['Algeria','Algiers'],['Angola','Luanda'],['Benin','Cotonou'],
  ['Botswana','Gaborone'],['Burkina Faso','Ouagadougou'],['Burundi','Bujumbura'],
  ['Cabo Verde','Praia'],['Cameroon','Douala'],['Central African Republic','Bangui'],
  ['Chad',"N'Djamena"],['Comoros','Moroni'],['Republic of the Congo','Pointe-Noire'],
  ['DR Congo','Kinshasa'],["Côte d'Ivoire",'Abidjan'],['Djibouti','Djibouti City'],
  ['Egypt','Cairo'],['Equatorial Guinea','Malabo'],['Eritrea','Asmara'],
  ['Eswatini','Manzini'],['Ethiopia','Addis Ababa'],['Gabon','Libreville'],
  ['Gambia','Serekunda'],['Ghana','Accra'],['Guinea','Conakry'],
  ['Guinea-Bissau','Bissau'],['Kenya','Nairobi'],['Lesotho','Maseru'],
  ['Liberia','Monrovia'],['Libya','Tripoli'],['Madagascar','Antananarivo'],
  ['Malawi','Blantyre'],['Mali','Bamako'],['Mauritania','Nouakchott'],
  ['Mauritius','Port Louis'],['Morocco','Casablanca'],['Mozambique','Maputo'],
  ['Namibia','Windhoek'],['Niger','Niamey'],['Nigeria','Lagos'],
  ['Rwanda','Kigali'],['São Tomé & Príncipe','São Tomé'],['Senegal','Dakar'],
  ['Seychelles','Victoria'],['Sierra Leone','Freetown'],['Somalia','Mogadishu'],
  ['South Africa','Johannesburg'],['South Sudan','Juba'],['Sudan','Khartoum'],
  ['Tanzania','Dar es Salaam'],['Togo','Lomé'],['Tunisia','Tunis'],
  ['Uganda','Kampala'],['Zambia','Lusaka'],['Zimbabwe','Harare'],
];

const now = new Date().toISOString();

// Columns: ID, Title, Location, City, State, Country, Description,
// Source URL, Source Name, Date Fetched, Last Verified, Created At, Updated At
// (remaining data columns left empty — agent populates them)
const rows = AFRICAN.map(([country, city]) => [
  uuidv4(),
  `${city}, ${country} — Entrepreneur City Profile`,
  `${city}, ${country}`,
  city,
  '',       // State — N/A for Africa
  country,
  `Entrepreneur dataset for ${city}, ${country}: ecosystem, funding opportunities, grants, and business environment for underrepresented founders.`,
  '',       // Source URL
  '',       // Source Name
  now,      // Date Fetched
  now,      // Last Verified
  now,      // Created At
  now,      // Updated At
]);

const sheets = google.sheets({ version: 'v4', auth });

// First check if African cities already exist
const existing = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'Records!D3:F200',
});
const existingCities = new Set(
  (existing.data.values || []).map(r => r[0]?.trim()).filter(Boolean)
);

const newRows = rows.filter(r => !existingCities.has(r[3]));
if (newRows.length === 0) {
  console.log('All African cities already in sheet.');
  process.exit(0);
}

await sheets.spreadsheets.values.append({
  spreadsheetId: SHEET_ID,
  range: 'Records!A3',
  valueInputOption: 'RAW',
  insertDataOption: 'INSERT_ROWS',
  requestBody: { values: newRows },
});

console.log(`Added ${newRows.length} African city rows. Skipped ${rows.length - newRows.length} already present.`);
