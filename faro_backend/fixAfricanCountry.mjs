import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: './service_account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEET_ID = '1xw_x-BE9cQ_9VNXjGOKYSDkbLcZNaiYzSVKwuCb4wqU';

// Map city → correct country
const AFRICAN_CITY_COUNTRY = {
  'Algiers':'Algeria','Cairo':'Egypt','Tripoli':'Libya','Casablanca':'Morocco',
  'Khartoum':'Sudan','Tunis':'Tunisia','Cotonou':'Benin','Ouagadougou':'Burkina Faso',
  'Praia':'Cabo Verde','Abidjan':"Côte d'Ivoire",'Serekunda':'Gambia','Accra':'Ghana',
  'Conakry':'Guinea','Bissau':'Guinea-Bissau','Monrovia':'Liberia','Bamako':'Mali',
  'Nouakchott':'Mauritania','Niamey':'Niger','Lagos':'Nigeria',
  'São Tomé':'São Tomé & Príncipe','Dakar':'Senegal','Freetown':'Sierra Leone',
  'Lomé':'Togo','Bujumbura':'Burundi','Moroni':'Comoros','Djibouti City':'Djibouti',
  'Asmara':'Eritrea','Addis Ababa':'Ethiopia','Nairobi':'Kenya',
  'Antananarivo':'Madagascar','Port Louis':'Mauritius','Kigali':'Rwanda',
  'Victoria':'Seychelles','Mogadishu':'Somalia','Juba':'South Sudan',
  'Dar es Salaam':'Tanzania','Kampala':'Uganda','Douala':'Cameroon',
  'Bangui':'Central African Republic',"N'Djamena":'Chad','Kinshasa':'DR Congo',
  'Malabo':'Equatorial Guinea','Libreville':'Gabon','Pointe-Noire':'Republic of the Congo',
  'Luanda':'Angola','Gaborone':'Botswana','Manzini':'Eswatini','Maseru':'Lesotho',
  'Blantyre':'Malawi','Maputo':'Mozambique','Windhoek':'Namibia',
  'Johannesburg':'South Africa','Lusaka':'Zambia','Harare':'Zimbabwe',
};

const sheets = google.sheets({ version: 'v4', auth });

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'Records!A3:M300',
});
const rows = res.data.values || [];

const updates = [];
for (let i = 0; i < rows.length; i++) {
  const row    = rows[i];
  const city   = (row[3] || '').trim();
  const country = AFRICAN_CITY_COUNTRY[city];
  if (!country) continue; // not an African city

  const rowNum = i + 3; // 1-based, data starts row 3
  const currentCountry = (row[5] || '').trim();
  const currentTitle   = (row[1] || '').trim();
  const currentLocation = (row[2] || '').trim();

  if (currentCountry === country && !currentTitle.includes('United States')) continue;

  // Fix: Title, Location, State, Country, Description
  const place = `${city}, ${country}`;
  const newTitle    = `${place} — Comprehensive City Profile`;
  const newLocation = place;
  const newState    = '';
  const newDesc     = `Comprehensive entrepreneur dataset for ${place}: economic indicators, business ecosystem, grants, policy incentives, and relocation costs.`;

  updates.push({
    range: `Records!B${rowNum}:G${rowNum}`,
    values: [[newTitle, newLocation, city, newState, country, newDesc]],
  });
  console.log(`  Row ${rowNum}: ${city} → ${country}`);
}

if (updates.length === 0) {
  console.log('No rows need fixing.');
} else {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });
  console.log(`\nFixed ${updates.length} rows.`);
}
