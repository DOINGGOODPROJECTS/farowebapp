import mysql from 'mysql2/promise';
import OpenAI from 'openai';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

const groq = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, database: 'faro_db', user: 'user', password: 'chi',
});

// Fetch all African cities from DB
const [africanCities] = await conn.execute(
  `SELECT id, name, country, region FROM \`City\` WHERE regionCode LIKE 'AFRICA_%'`
);

console.log(`Found ${africanCities.length} African cities to fill.\n`);

const BATCH_SIZE = 5;

async function fetchCityData(cities) {
  const cityList = cities.map(c => `- ${c.name}, ${c.country}`).join('\n');

  const prompt = `You are a data researcher. For each city below, return ONLY a JSON array with one object per city.
Use real-world data from public sources (World Bank, Numbeo, IMF, UN). Be as accurate as possible.

Cities:
${cityList}

Return a JSON array (no markdown, no explanation) like:
[
  {
    "name": "CityName",
    "country": "CountryName",
    "population": 2500000,
    "medianIncome": 450,
    "costIndex": 38,
    "businessScore": 55,
    "opportunityScore": 52,
    "networkStrength": 45,
    "housingIndex": 35,
    "highlights": ["Hub for X industry", "Growing startup ecosystem", "Free trade zone"],
    "industries": ["Technology", "Finance", "Agriculture"],
    "incentives": ["Tax holidays for investors", "Special Economic Zones"]
  }
]

Fields guide:
- population: city proper population (integer)
- medianIncome: estimated monthly median income in USD (integer)
- costIndex: 0-100 where 100 = most expensive (like Numbeo cost index, US cities ~65-95)
- businessScore: 0-100 based on World Bank ease of doing business & entrepreneurship ecosystem
- opportunityScore: 0-100 composite of business, network, cost opportunity for entrepreneurs
- networkStrength: 0-100 strength of business/startup network
- housingIndex: 0-100 housing affordability (lower = more affordable)
- highlights: 3 real facts about the city for entrepreneurs
- industries: 3 major industries
- incentives: 2 real business incentives or policies`;

  const res = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const raw = res.choices[0]?.message?.content ?? '';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON found in: ${raw.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

let updated = 0;
const errors = [];

for (let i = 0; i < africanCities.length; i += BATCH_SIZE) {
  const batch = africanCities.slice(i, i + BATCH_SIZE);
  process.stdout.write(`Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(africanCities.length/BATCH_SIZE)} — ${batch.map(c=>c.name).join(', ')} ... `);

  try {
    const data = await fetchCityData(batch);

    for (const cityData of data) {
      const dbCity = batch.find(c =>
        c.name.toLowerCase() === cityData.name?.toLowerCase() ||
        c.name.toLowerCase().includes(cityData.name?.toLowerCase())
      );
      if (!dbCity) { errors.push(`No match for ${cityData.name}`); continue; }

      // Update city core fields
      await conn.execute(
        `UPDATE \`City\` SET population=?, medianIncome=?, costIndex=?, businessScore=?,
         opportunityScore=?, networkStrength=?, housingIndex=? WHERE id=?`,
        [
          cityData.population || null,
          cityData.medianIncome || null,
          cityData.costIndex || null,
          cityData.businessScore || null,
          cityData.opportunityScore || null,
          cityData.networkStrength || null,
          cityData.housingIndex || null,
          dbCity.id,
        ]
      );

      // Delete old related data
      await conn.execute('DELETE FROM `CityHighlight` WHERE cityId=?', [dbCity.id]);
      await conn.execute('DELETE FROM `CityIndustry`  WHERE cityId=?', [dbCity.id]);
      await conn.execute('DELETE FROM `CityIncentive` WHERE cityId=?', [dbCity.id]);

      // Insert highlights
      for (const [idx, text] of (cityData.highlights || []).entries()) {
        await conn.execute('INSERT INTO `CityHighlight` (cityId, text, `order`) VALUES (?,?,?)', [dbCity.id, text, idx]);
      }
      // Insert industries
      for (const name of (cityData.industries || [])) {
        await conn.execute('INSERT INTO `CityIndustry` (cityId, name) VALUES (?,?)', [dbCity.id, name]);
      }
      // Insert incentives
      for (const title of (cityData.incentives || [])) {
        await conn.execute('INSERT INTO `CityIncentive` (cityId, title, description) VALUES (?,?,?)', [dbCity.id, title, '']);
      }

      updated++;
    }
    console.log('✓');
  } catch (err) {
    console.log(`✗ ${err.message.slice(0,80)}`);
    errors.push(`Batch ${i}-${i+BATCH_SIZE}: ${err.message.slice(0,100)}`);
  }

  // Small delay to respect rate limits
  if (i + BATCH_SIZE < africanCities.length) await new Promise(r => setTimeout(r, 1500));
}

console.log(`\nDone. Updated: ${updated}/${africanCities.length} cities.`);
if (errors.length) console.log('Errors:', errors);
await conn.end();
