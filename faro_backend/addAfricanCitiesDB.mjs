import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  database: 'faro_db',
  user: 'user',
  password: 'chi',
});

const AFRICAN_CITIES = [
  // North Africa
  { name: 'Algiers',        state: '',        country: 'Algeria',                   region: 'North Africa',   regionCode: 'AFRICA_NORTH' },
  { name: 'Cairo',          state: '',        country: 'Egypt',                     region: 'North Africa',   regionCode: 'AFRICA_NORTH' },
  { name: 'Tripoli',        state: '',        country: 'Libya',                     region: 'North Africa',   regionCode: 'AFRICA_NORTH' },
  { name: 'Casablanca',     state: '',        country: 'Morocco',                   region: 'North Africa',   regionCode: 'AFRICA_NORTH' },
  { name: 'Khartoum',       state: '',        country: 'Sudan',                     region: 'North Africa',   regionCode: 'AFRICA_NORTH' },
  { name: 'Tunis',          state: '',        country: 'Tunisia',                   region: 'North Africa',   regionCode: 'AFRICA_NORTH' },

  // West Africa
  { name: 'Cotonou',        state: '',        country: 'Benin',                     region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Ouagadougou',    state: '',        country: 'Burkina Faso',              region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Praia',          state: '',        country: 'Cabo Verde',                region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Abidjan',        state: '',        country: "Côte d'Ivoire",             region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Serekunda',      state: '',        country: 'Gambia',                    region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Accra',          state: '',        country: 'Ghana',                     region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Conakry',        state: '',        country: 'Guinea',                    region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Bissau',         state: '',        country: 'Guinea-Bissau',             region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Monrovia',       state: '',        country: 'Liberia',                   region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Bamako',         state: '',        country: 'Mali',                      region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Nouakchott',     state: '',        country: 'Mauritania',                region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Niamey',         state: '',        country: 'Niger',                     region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Lagos',          state: 'Lagos State', country: 'Nigeria',              region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'São Tomé',       state: '',        country: 'São Tomé & Príncipe',       region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Dakar',          state: '',        country: 'Senegal',                   region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Freetown',       state: '',        country: 'Sierra Leone',              region: 'West Africa',    regionCode: 'AFRICA_WEST' },
  { name: 'Lomé',           state: '',        country: 'Togo',                      region: 'West Africa',    regionCode: 'AFRICA_WEST' },

  // East Africa
  { name: 'Bujumbura',      state: '',        country: 'Burundi',                   region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Moroni',         state: '',        country: 'Comoros',                   region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Djibouti City',  state: '',        country: 'Djibouti',                  region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Asmara',         state: '',        country: 'Eritrea',                   region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Addis Ababa',    state: '',        country: 'Ethiopia',                  region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Nairobi',        state: '',        country: 'Kenya',                     region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Antananarivo',   state: '',        country: 'Madagascar',                region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Port Louis',     state: '',        country: 'Mauritius',                 region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Kigali',         state: '',        country: 'Rwanda',                    region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Victoria',       state: '',        country: 'Seychelles',                region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Mogadishu',      state: '',        country: 'Somalia',                   region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Juba',           state: '',        country: 'South Sudan',               region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Dar es Salaam',  state: '',        country: 'Tanzania',                  region: 'East Africa',    regionCode: 'AFRICA_EAST' },
  { name: 'Kampala',        state: '',        country: 'Uganda',                    region: 'East Africa',    regionCode: 'AFRICA_EAST' },

  // Central Africa
  { name: 'Douala',         state: '',        country: 'Cameroon',                  region: 'Central Africa', regionCode: 'AFRICA_CENTRAL' },
  { name: 'Bangui',         state: '',        country: 'Central African Republic',  region: 'Central Africa', regionCode: 'AFRICA_CENTRAL' },
  { name: "N'Djamena",      state: '',        country: 'Chad',                      region: 'Central Africa', regionCode: 'AFRICA_CENTRAL' },
  { name: 'Kinshasa',       state: '',        country: 'DR Congo',                  region: 'Central Africa', regionCode: 'AFRICA_CENTRAL' },
  { name: 'Malabo',         state: '',        country: 'Equatorial Guinea',         region: 'Central Africa', regionCode: 'AFRICA_CENTRAL' },
  { name: 'Libreville',     state: '',        country: 'Gabon',                     region: 'Central Africa', regionCode: 'AFRICA_CENTRAL' },
  { name: 'Pointe-Noire',   state: '',        country: 'Republic of the Congo',     region: 'Central Africa', regionCode: 'AFRICA_CENTRAL' },

  // Southern Africa
  { name: 'Luanda',         state: '',        country: 'Angola',                    region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Gaborone',       state: '',        country: 'Botswana',                  region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Manzini',        state: '',        country: 'Eswatini',                  region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Maseru',         state: '',        country: 'Lesotho',                   region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Blantyre',       state: '',        country: 'Malawi',                    region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Maputo',         state: '',        country: 'Mozambique',                region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Windhoek',       state: '',        country: 'Namibia',                   region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Johannesburg',   state: 'Gauteng', country: 'South Africa',              region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Lusaka',         state: '',        country: 'Zambia',                    region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
  { name: 'Harare',         state: '',        country: 'Zimbabwe',                  region: 'Southern Africa', regionCode: 'AFRICA_SOUTH' },
];

function toSlug(name, country) {
  return `${name}-${country}`
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let inserted = 0, skipped = 0;

for (const city of AFRICAN_CITIES) {
  const slug = toSlug(city.name, city.country);
  const [existing] = await conn.execute('SELECT id FROM `City` WHERE slug = ?', [slug]);
  if (existing.length > 0) {
    skipped++;
    continue;
  }
  await conn.execute(
    `INSERT INTO \`City\` (slug, name, state, country, region, regionCode)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [slug, city.name, city.state, city.country, city.region, city.regionCode]
  );
  inserted++;
  console.log(`  + ${city.name}, ${city.country} [${city.regionCode}]`);
}

console.log(`\nDone. Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
await conn.end();
