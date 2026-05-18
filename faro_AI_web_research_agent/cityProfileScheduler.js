/**
 * cityProfileScheduler.js
 *
 * Automatically re-extracts and updates city profile fields on two schedules:
 *   Weekly  (every Monday  03:00): dynamic fields that change frequently
 *   Monthly (1st of month  02:00): stable fields that change slowly
 *
 * Usage:  node cityProfileScheduler.js
 *
 * The scheduler reads target_cities.json, fetches fresh data from the web,
 * and writes only the target columns for each city using updateCityRowColumns().
 * Cities are processed in batches of CONCURRENCY=2 to avoid rate limits.
 */

import cron            from "node-cron";
import { readFileSync } from "fs";
import OpenAI           from "openai";
import dotenv           from "dotenv";
import { fileURLToPath } from "url";
import path              from "path";

import { fetchPageText }          from "./fetchPage.js";
import { getSheetRows, updateCityRowColumns } from "./googleSheets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config();

// ── AI client ─────────────────────────────────────────────────────────────────
const useHermes = process.env.USE_HERMES === "true";
const client = useHermes
  ? new OpenAI({ baseURL: "http://localhost:11434/v1", apiKey: "ollama" })
  : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = useHermes
  ? (process.env.HERMES_MODEL || "hermes3:3b")
  : (process.env.OPENAI_MODEL  || "gpt-4o-mini");

const MAX_TEXT   = useHermes ? 2500 : 7000;
const CONCURRENCY = 2;
const BATCH_DELAY = 3000; // ms between batches

// ── Weekly fields ─────────────────────────────────────────────────────────────
// Fields that are refreshed every Monday (market conditions, grant deadlines)
const WEEKLY_FIELDS = [
  "business_environment",
  "underrepresented_entrepreneurs_pct",
  "opportunity_score",
  "startup_hubs",
  "network_strength",
  "funder",
  "eligibility_criteria",
  "deadline",
  "target_audience",
];

// ── Monthly fields ────────────────────────────────────────────────────────────
// Fields refreshed on the 1st of each month (slower-changing economic data)
const MONTHLY_FIELDS = [
  "housing_rent_estimates",
  "housing_index_score",
  "median_income",
  "employment_indicators",
  "industry_strengths",
  "incubators_accelerators",
  "coworking_spaces",
  "mentorship_networks",
  "black_business_organizations",
  "government_backed_initiatives",
  "living_expenses",
  "business_setup_costs",
  "hiring_costs",
  "utilities_and_infrastructure",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanJson(raw = "") {
  return raw
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "")
    .trim();
}

async function aiCall(prompt) {
  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    return JSON.parse(cleanJson(resp.choices[0].message.content));
  } catch {
    return null;
  }
}

async function safeFetch(url) {
  try { return (await fetchPageText(url)).text || ""; }
  catch { return ""; }
}

async function searchDDG(query, maxResults = 3) {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      }
    );
    const html = await res.text();
    const urls = [];
    for (const m of html.matchAll(/uddg=([^"&\s]+)/g)) {
      const url = decodeURIComponent(m[1]);
      if (url.startsWith("http") && !url.includes("duckduckgo.com")) {
        urls.push(url);
        if (urls.length >= maxResults) break;
      }
    }
    return urls;
  } catch {
    return [];
  }
}

function ensureScore(val) {
  const n = parseInt(String(val ?? ""));
  return Number.isFinite(n) && n >= 1 && n <= 100 ? String(n) : "50";
}

// ── Weekly field extractor ────────────────────────────────────────────────────
// Extracts only the 9 weekly fields for a given city.

async function extractWeeklyFields(city, state, cityData) {
  const { govUrl, stateGovUrl, grantUrl, chamberUrl, ecosystemUrl } = cityData;

  const [ecosystemUrls, grantUrls] = await Promise.all([
    searchDDG(`"${city}" "${state}" startup hub innovation district Black business organizations 2025`, 3),
    searchDDG(`"${city}" OR "${state}" small business grants minority entrepreneurs funding deadline 2025`, 3),
  ]);

  const [ecosystemText, grantText] = await Promise.all([
    Promise.all([chamberUrl, ecosystemUrl, ...ecosystemUrls].filter(Boolean).map(safeFetch))
      .then(ts => ts.filter(t => t.length > 80).join("\n\n---\n\n")),
    Promise.all([grantUrl, ...grantUrls].filter(Boolean).map(safeFetch))
      .then(ts => ts.filter(t => t.length > 80).join("\n\n---\n\n")),
  ]);

  const [ecosystemData, grantData] = await Promise.all([
    aiCall(`
You are extracting CURRENT business ecosystem data for ${city}, ${state}, USA.
Return ONLY valid JSON with ALL fields filled with specific, real values:
{
  "business_environment": "Specific tax advantages, enterprise zones, rankings, and programs that attract business owners in ${city}.",
  "startup_hubs": "Primary innovation district or tech hub in ${city}: name, neighborhood, and what makes it notable.",
  "network_strength": "Integer 0–100 density and quality of mentors, accelerators, and support orgs for underrepresented entrepreneurs in ${city}.",
  "underrepresented_entrepreneurs_pct": "Integer 0–100 estimated % of underrepresented (minority, women, veteran) founders among all business owners in ${city}.",
  "opportunity_score": "Integer 0–100 overall entrepreneurial opportunity for underrepresented founders in ${city}. Factor economic conditions, grants, policy, market size."
}
Web text:
${ecosystemText.slice(0, MAX_TEXT)}
`),
    aiCall(`
You are extracting CURRENT grants and funding data for entrepreneurs in ${city}, ${state}, USA.
Return ONLY valid JSON with ALL fields filled with specific, real values:
{
  "funder": "Full legal name of the organization offering a real grant available in ${city} or ${state}.",
  "eligibility_criteria": "Specific requirements: business size, ownership type (minority/women/veteran), industry, revenue cap.",
  "deadline": "Current application deadline, cycle (e.g. 'Quarterly'), or 'Rolling basis'.",
  "target_audience": "Exactly who qualifies: e.g. minority-owned small businesses under 5 years old with under $1M revenue in ${state}."
}
Web text:
${grantText.slice(0, MAX_TEXT)}
`),
  ]);

  const result = {};

  if (ecosystemData) {
    if (ecosystemData.business_environment) result.business_environment = ecosystemData.business_environment;
    if (ecosystemData.startup_hubs)         result.startup_hubs = ecosystemData.startup_hubs;
    if (ecosystemData.network_strength)     result.network_strength = ensureScore(ecosystemData.network_strength);
    if (ecosystemData.underrepresented_entrepreneurs_pct)
      result.underrepresented_entrepreneurs_pct = ensureScore(ecosystemData.underrepresented_entrepreneurs_pct);
    if (ecosystemData.opportunity_score)    result.opportunity_score = ensureScore(ecosystemData.opportunity_score);
  }

  if (grantData) {
    if (grantData.funder)               result.funder = grantData.funder;
    if (grantData.eligibility_criteria) result.eligibility_criteria = grantData.eligibility_criteria;
    if (grantData.deadline)             result.deadline = grantData.deadline;
    if (grantData.target_audience)      result.target_audience = grantData.target_audience;
  }

  // Fallback: fill any still-missing weekly fields with AI knowledge
  const missing = WEEKLY_FIELDS.filter(f => !result[f]);
  if (missing.length > 0) {
    const schema = Object.fromEntries(missing.map(f => [f, `Specific value for ${f} in ${city}, ${state}`]));
    const fallback = await aiCall(`
Using your training knowledge, provide specific values for these fields for ${city}, ${state}, USA.
Return ONLY valid JSON — no empty values, no "N/A":
${JSON.stringify(schema, null, 2)}
`);
    if (fallback) {
      for (const f of missing) {
        if (fallback[f]) {
          const v = String(fallback[f]);
          result[f] = ["network_strength","underrepresented_entrepreneurs_pct","opportunity_score"].includes(f)
            ? ensureScore(v) : v;
        }
      }
    }
  }

  return result;
}

// ── Monthly field extractor ───────────────────────────────────────────────────
// Extracts only the 14 monthly fields for a given city.

async function extractMonthlyFields(city, state, cityData) {
  const { censusSlug, govUrl, stateGovUrl, ecosystemUrl, chamberUrl } = cityData;

  const censusUrl = `https://www.census.gov/quickfacts/${censusSlug}`;
  const numbeoUrl = `https://www.numbeo.com/cost-of-living/in/${encodeURIComponent(city)}`;

  const [econUrls, ecosystemUrls, costUrls] = await Promise.all([
    searchDDG(`"${city}" "${state}" median income employment rate cost of living 2025`, 2),
    searchDDG(`"${city}" "${state}" incubators accelerators coworking mentorship programs 2025`, 2),
    searchDDG(`"${city}" living expenses rent utilities business setup cost 2025`, 2),
  ]);

  const [econText, ecosystemText, costText, policyText] = await Promise.all([
    Promise.all([censusUrl, govUrl, ...econUrls].filter(Boolean).map(safeFetch))
      .then(ts => ts.filter(t => t.length > 80).join("\n\n---\n\n")),
    Promise.all([chamberUrl, ecosystemUrl, ...ecosystemUrls].filter(Boolean).map(safeFetch))
      .then(ts => ts.filter(t => t.length > 80).join("\n\n---\n\n")),
    Promise.all([numbeoUrl, govUrl, ...costUrls].filter(Boolean).map(safeFetch))
      .then(ts => ts.filter(t => t.length > 80).join("\n\n---\n\n")),
    Promise.all([govUrl, stateGovUrl].filter(Boolean).map(safeFetch))
      .then(ts => ts.filter(t => t.length > 80).join("\n\n---\n\n")),
  ]);

  const [econData, ecosystemData, costData, policyData] = await Promise.all([
    aiCall(`
Extract CURRENT economic data for ${city}, ${state}, USA. Return ONLY valid JSON with ALL fields:
{
  "housing_rent_estimates": "Average monthly rent: studio, 1BR, 2BR in ${city} with specific dollar amounts.",
  "housing_index_score": "Integer 0–100 housing affordability (100 = most affordable) based on rent-to-income ratio in ${city}.",
  "median_income": "Current median household income and per capita income in ${city} with Census year and poverty rate.",
  "employment_indicators": "Current unemployment rate and top 5 employers by name in ${city} with approximate headcount.",
  "industry_strengths": "Top 5 industries with real named companies headquartered or with major presence in ${city}."
}
Web text:
${econText.slice(0, MAX_TEXT)}
`),
    aiCall(`
Extract CURRENT business ecosystem data for ${city}, ${state}, USA. Return ONLY valid JSON with ALL fields:
{
  "incubators_accelerators": "2–4 real incubator or accelerator names operating in ${city} with brief descriptions.",
  "coworking_spaces": "Real coworking spaces with specific names and neighborhoods in ${city}.",
  "mentorship_networks": "SCORE chapter name, local SBDC center name and location, and notable mentorship programs in ${city}.",
  "black_business_organizations": "Names of Black-focused business organizations, minority chambers, and professional networks in ${city}."
}
Web text:
${ecosystemText.slice(0, MAX_TEXT)}
`),
    aiCall(`
Extract CURRENT cost and relocation data for ${city}, ${state}, USA. Return ONLY valid JSON with ALL fields:
{
  "living_expenses": "Monthly cost of living in ${city}: rent + groceries + transportation + utilities with specific dollar amounts and total range.",
  "business_setup_costs": "Cost to start a business in ${state}: LLC filing fee (exact $), registered agent fee ($/yr), local business license (approx $).",
  "hiring_costs": "${state} current minimum wage ($/hr), average hourly pay for admin/retail/tech in ${city}, and employer payroll tax rate.",
  "utilities_and_infrastructure": "Average monthly utility costs in ${city}: electricity, internet, water+gas in $/mo. Note key providers."
}
Web text:
${costText.slice(0, MAX_TEXT)}
`),
    aiCall(`
Extract CURRENT policy and initiatives data for ${city}, ${state}, USA. Return ONLY valid JSON:
{
  "government_backed_initiatives": "Real federal and ${city} initiatives: Opportunity Zone tracts, CDBG allocation, MBDA Business Center presence, notable city economic programs."
}
Web text:
${policyText.slice(0, MAX_TEXT)}
`),
  ]);

  const result = {};

  const merge = (data, fields) => {
    if (!data) return;
    for (const f of fields) {
      if (data[f]) {
        const v = String(data[f]);
        result[f] = ["housing_index_score"].includes(f) ? ensureScore(v) : v;
      }
    }
  };

  merge(econData,      ["housing_rent_estimates","housing_index_score","median_income","employment_indicators","industry_strengths"]);
  merge(ecosystemData, ["incubators_accelerators","coworking_spaces","mentorship_networks","black_business_organizations"]);
  merge(costData,      ["living_expenses","business_setup_costs","hiring_costs","utilities_and_infrastructure"]);
  merge(policyData,    ["government_backed_initiatives"]);

  // Fallback for any still-missing monthly fields
  const missing = MONTHLY_FIELDS.filter(f => !result[f]);
  if (missing.length > 0) {
    const schema = Object.fromEntries(missing.map(f => [f, `Specific value for ${f} in ${city}, ${state}`]));
    const fallback = await aiCall(`
Using your training knowledge, provide specific values for these fields for ${city}, ${state}, USA.
Return ONLY valid JSON — no empty values, no "N/A":
${JSON.stringify(schema, null, 2)}
`);
    if (fallback) {
      for (const f of missing) {
        if (fallback[f]) {
          result[f] = f === "housing_index_score" ? ensureScore(String(fallback[f])) : String(fallback[f]);
        }
      }
    }
  }

  return result;
}

// ── Batch processor ───────────────────────────────────────────────────────────

async function processBatch(cities, rowMap, extractFn, label) {
  let updated = 0;
  let failed  = 0;

  for (let i = 0; i < cities.length; i += CONCURRENCY) {
    const batch = cities.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (cityData) => {
      const { city, state } = cityData;
      const key = `${city}, ${state}`;
      const rowInfo = rowMap.get(key);

      if (!rowInfo) {
        console.log(`  [${label}] ${city} — not found in sheet, skipping`);
        return;
      }

      try {
        console.log(`  [${label}] Updating ${city}, ${state} (row ${rowInfo.rowNumber})...`);
        const fields = await extractFn(city, state, cityData);
        await updateCityRowColumns(rowInfo.rowNumber, fields);
        updated++;
        console.log(`  [${label}] ${city} ✓ (${Object.keys(fields).length} fields updated)`);
      } catch (err) {
        failed++;
        console.error(`  [${label}] ${city} failed: ${err.message}`);
      }
    }));

    if (i + CONCURRENCY < cities.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  return { updated, failed };
}

// ── Load cities ───────────────────────────────────────────────────────────────

function loadCities() {
  const file = path.join(__dirname, "target_cities.json");
  return JSON.parse(readFileSync(file, "utf-8"));
}

// ── Weekly update job ─────────────────────────────────────────────────────────

async function runWeeklyUpdate() {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] === WEEKLY UPDATE STARTED ===`);
  console.log(`Fields: ${WEEKLY_FIELDS.join(", ")}`);

  const cities = loadCities();
  const rows   = await getSheetRows();

  // Build city-name → { rowNumber } map
  const rowMap = new Map();
  for (const row of rows) {
    rowMap.set(`${row.city}, ${row.state}`, { rowNumber: row.rowNumber });
  }

  console.log(`Cities: ${cities.length} | Sheet rows: ${rows.length}`);

  const { updated, failed } = await processBatch(
    cities,
    rowMap,
    (city, state, cityData) => extractWeeklyFields(city, state, cityData),
    "WEEKLY"
  );

  console.log(`\n[${new Date().toISOString()}] === WEEKLY UPDATE COMPLETE ===`);
  console.log(`  Updated: ${updated} | Failed: ${failed}`);
}

// ── Monthly update job ────────────────────────────────────────────────────────

async function runMonthlyUpdate() {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] === MONTHLY UPDATE STARTED ===`);
  console.log(`Fields: ${MONTHLY_FIELDS.join(", ")}`);

  const cities = loadCities();
  const rows   = await getSheetRows();

  const rowMap = new Map();
  for (const row of rows) {
    rowMap.set(`${row.city}, ${row.state}`, { rowNumber: row.rowNumber });
  }

  console.log(`Cities: ${cities.length} | Sheet rows: ${rows.length}`);

  const { updated, failed } = await processBatch(
    cities,
    rowMap,
    (city, state, cityData) => extractMonthlyFields(city, state, cityData),
    "MONTHLY"
  );

  console.log(`\n[${new Date().toISOString()}] === MONTHLY UPDATE COMPLETE ===`);
  console.log(`  Updated: ${updated} | Failed: ${failed}`);
}

// ── Schedule ──────────────────────────────────────────────────────────────────

// Every Monday at 03:00 AM
cron.schedule("0 3 * * 1", runWeeklyUpdate, { timezone: "America/New_York" });

// 1st of every month at 02:00 AM
cron.schedule("0 2 1 * *", runMonthlyUpdate, { timezone: "America/New_York" });

console.log("City Profile Scheduler running");
console.log("  Weekly  update: every Monday    03:00 AM ET");
console.log("  Monthly update: 1st of month    02:00 AM ET");
console.log("  Press Ctrl+C to stop\n");
