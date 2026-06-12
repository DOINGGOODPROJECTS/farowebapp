/**
 * cityProfileAgent.js
 *
 * For each target city:
 *   1. Runs DuckDuckGo searches to find city-specific web pages per data category
 *   2. Fetches pre-defined authoritative sources (Census, Numbeo, city gov, state gov)
 *   3. Extracts ALL 29 data columns using strict AI prompts that demand real, city-specific data
 *   4. Falls back to AI training-knowledge if extracted data is generic/empty
 *   5. Skips cities already fully filled in the sheet; updates incomplete rows in place
 *
 * Usage:  node cityProfileAgent.js [target_cities.json]
 */

import { readFileSync }  from "fs";
import OpenAI            from "openai";
import dotenv            from "dotenv";
import { fileURLToPath } from "url";
import path              from "path";

import { fetchPageText }                                          from "./fetchPage.js";
import { appendCityProfileRow, getSheetRows, updateCityProfileRow } from "./googleSheets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config();

// ── AI client — Groq primary (free, fast), Hermes fallback ───────────────────
const useHermes = process.env.USE_HERMES === "true" && !process.env.GROQ_API_KEY;
const client = process.env.GROQ_API_KEY
  ? new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY })
  : useHermes
    ? new OpenAI({ baseURL: "http://localhost:11434/v1", apiKey: "ollama" })
    : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.GROQ_API_KEY
  ? (process.env.GROQ_MODEL || "llama-3.1-8b-instant")
  : useHermes
    ? (process.env.HERMES_MODEL || "hermes3:3b")
    : (process.env.OPENAI_MODEL || "gpt-4o-mini");

const MAX_TEXT = process.env.GROQ_API_KEY ? 6000 : useHermes ? 2500 : 7000;
const CONCURRENCY = 2;

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

async function fetchMany(urls) {
  const texts = await Promise.all(urls.filter(Boolean).map(u => safeFetch(u)));
  return texts.filter(t => t.length > 80).join("\n\n---\n\n");
}

// ── DuckDuckGo search via plain HTTP (no browser needed) ─────────────────────

async function searchDDG(query, maxResults = 3) {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

// ── Type enforcers ────────────────────────────────────────────────────────────

// Score field: must be integer 1–100. Returns "" if wrong type so it gets re-fetched.
function ensureScore(val) {
  const n = parseInt(String(val ?? ""));
  return Number.isFinite(n) && n >= 1 && n <= 100 ? String(n) : "";
}

// Text field: must NOT be a bare number. Returns "" if just a number so it gets re-fetched.
function ensureText(val) {
  if (val == null || val === "") return "";
  if (Array.isArray(val)) return val.map(i => typeof i === "object" ? Object.values(i).filter(Boolean).join(" | ") : String(i)).join("; ");
  if (typeof val === "object") return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join("; ");
  const str = String(val).trim();
  if (!str || str.includes("[object Object]")) return "";
  // Reject if the value is just a plain number (e.g. "50", "85", "0")
  if (/^\d+(\.\d+)?$/.test(str)) return "";
  return str;
}

const SCORE_FIELDS = new Set([
  "cost_index", "housing_index_score", "opportunity_score",
  "network_strength", "business_score", "underrepresented_entrepreneurs_pct",
]);

// ── Field descriptions used by the missing-field fallback ────────────────────
const FIELD_DESCRIPTIONS = {
  cost_of_living:                    "Cost-of-living index vs US average of 100. Include housing, grocery, utility, transport sub-indexes.",
  cost_index:                        "Integer 0–100 affordability score (100 = cheapest). Derive from cost-of-living vs US average.",
  housing_rent_estimates:            "Average monthly rent: studio, 1BR, 2BR in dollars. Include downtown vs suburb variation.",
  housing_index_score:               "Integer 0–100 housing affordability (100 = most affordable). Derive from rent-to-income ratio.",
  median_income:                     "Median household income and per capita income with Census year. Include poverty rate.",
  employment_indicators:             "Unemployment rate (cite BLS) and top 5 employers by name with approximate headcount.",
  industry_strengths:                "Top 5 industries with real named companies headquartered or with major presence.",
  business_environment:              "Specific tax advantages, enterprise zones, rankings, and programs that attract business owners.",
  minority_representation:           "Black/minority population % (Census) and minority-owned business %. Any notable rankings.",
  underrepresented_entrepreneurs_pct:"Integer 0–100 estimated % of underrepresented (minority, women, veteran) founders among all business owners.",
  opportunity_score:                 "Integer 0–100 overall entrepreneurial opportunity for underrepresented founders. Factor economic conditions, grants, policy, market size.",
  incubators_accelerators:           "2–4 real incubator or accelerator names operating in the city with brief descriptions.",
  coworking_spaces:                  "Real coworking spaces with specific names and neighborhoods.",
  startup_hubs:                      "Primary innovation district or tech hub: name, neighborhood, and what makes it notable.",
  mentorship_networks:               "SCORE chapter full name, local SBDC center name and location, and notable mentorship programs.",
  network_strength:                  "Integer 0–100 density and quality of mentors, accelerators, and support orgs for underrepresented entrepreneurs.",
  chambers_of_commerce:              "Full name and website of the primary Chamber of Commerce.",
  black_business_organizations:      "Names of Black-focused business organizations, minority chambers, and professional networks.",
  business_score:                    "Integer 0–100 business-friendliness for underrepresented entrepreneurs. Factor ecosystem, ease of starting, tax, support.",
  grant_name:                        "Full name of a real grant or funding program for entrepreneurs in the city or state.",
  funder:                            "Full legal name of the government agency, nonprofit, or foundation offering the grant.",
  eligibility_criteria:              "Specific requirements: business size, ownership type (minority/women/veteran), industry, revenue cap.",
  funding_amount:                    "Specific dollar range (e.g. '$5,000 to $50,000').",
  deadline:                          "Application deadline, cycle, or 'Rolling basis'.",
  application_link:                  "Direct URL to the grant application or program page.",
  geographic_scope:                  "Whether grant covers city, state, multi-state, or national.",
  target_audience:                   "Exactly who qualifies (e.g. minority-owned small businesses under 5 years, under $1M revenue).",
  tax_incentives:                    "Real tax credit programs with specific credit amounts or rates.",
  startup_support_programs:          "Real city and state programs supporting startups — names, what they provide, who runs them.",
  minority_business_certifications:  "Federal SBA 8(a), WOSB, HUBZone, SDVOSB plus state MBE/WBE/DBE programs with issuing agencies.",
  government_backed_initiatives:     "Opportunity Zone tracts, CDBG use, MBDA Business Center presence, notable city economic programs.",
  living_expenses:                   "Monthly cost breakdown: rent + groceries + transportation + utilities with specific dollar amounts.",
  business_setup_costs:              "LLC filing fee (exact $), registered agent ($/yr), local business license (approx $), key permits.",
  hiring_costs:                      "State minimum wage ($/hr), average hourly pay for admin/retail/tech roles, employer payroll tax rate.",
  utilities_and_infrastructure:      "Average monthly electricity, internet, water+gas costs. Key providers and internet quality.",
};

// ── Fill every empty field with a targeted AI knowledge call ─────────────────
async function fillMissingFields(city, region, profile, isUS = true) {
  // A field needs filling if: empty, [object Object], wrong type (score in text col or text in score col)
  const needsFill = (key, val) => {
    if (val == null || val === "") return true;
    if (typeof val === "object") return true;
    const s = String(val).trim();
    if (!s || s.includes("[object Object]")) return true;
    if (SCORE_FIELDS.has(key)) {
      // Score field: must be an integer 1-100
      const n = parseInt(s);
      return !Number.isFinite(n) || n < 1 || n > 100;
    } else {
      // Text field: must not be a bare number
      return /^\d+(\.\d+)?$/.test(s);
    }
  };

  const missing = Object.entries(FIELD_DESCRIPTIONS)
    .filter(([key]) => needsFill(key, profile[key]));

  if (missing.length === 0) return;

  console.log(`  [${city}] Filling ${missing.length} empty field(s) with AI knowledge...`);

  const location = isUS ? `${city}, ${region}, USA` : `${city}, ${region}`;
  const note = isUS
    ? "Use real Census, BLS, SBA, and state data."
    : "Use your knowledge of this African city. All amounts in USD equivalent.";

  const schema = Object.fromEntries(missing.map(([k, desc]) => [k, desc]));

  const filled = await aiCall(`
Using your training knowledge, provide a SPECIFIC, NON-EMPTY value for every field below for ${location}.
${note}

STRICT RULES:
- Every field MUST have a REAL, specific, non-generic value. No placeholders, no "[object Object]".
- Text fields: real names, real dollar amounts, real percentages — plain strings only.
- Score fields (integers 0–100): provide a REAL estimate based on your knowledge. Do NOT use 50 as a default.
- URL fields: use the most likely official URL.
- NEVER return arrays or nested objects — plain strings only.

Return ONLY valid JSON with every key filled:
${JSON.stringify(schema, null, 2)}
`);

  if (!filled) return;

  const s = v => {
    if (v == null || v === "") return "";
    if (Array.isArray(v)) return v.map(i => typeof i === "object" ? Object.values(i).filter(Boolean).join(" | ") : String(i)).join("; ");
    if (typeof v === "object") return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join("; ");
    const str = String(v).trim();
    return (str === "0" || str === "50" || str.includes("[object Object]")) ? "" : str;
  };

  for (const [key] of missing) {
    const raw = filled[key];
    const val = SCORE_FIELDS.has(key) ? ensureScore(raw) : ensureText(raw);
    if (val) profile[key] = val;
  }
}

// ── Generic-content detector ──────────────────────────────────────────────────
// Returns true when the extracted object contains too many vague/template phrases.

const GENERIC_PHRASES = [
  "contact local", "contact the city", "contact city", "see website",
  "visit website", "varies by", "check with", "multiple options",
  "various programs", "reach out to", "for more information",
  "contact funder", "contact real estate", "available upon request",
  "contact chamber", "contact sbdc",
];

function isGeneric(obj) {
  if (!obj || typeof obj !== "object") return true;
  const text = JSON.stringify(obj).toLowerCase();
  return GENERIC_PHRASES.filter(p => text.includes(p)).length >= 2;
}

// ── AI-knowledge fallback (no web text — uses model's own city knowledge) ─────

function buildFallbackPrompt(category, city, region, isUS) {
  const location = isUS ? `${city}, ${region}, USA` : `${city}, ${region}`;
  const currency = isUS ? "USD" : "USD (and local currency equivalent)";
  const minorNote = isUS
    ? "minority/Black/women/veteran-owned businesses"
    : "women, youth, diaspora, and underrepresented entrepreneurs";

  const prompts = {
    economic: `Using your training knowledge, fill in SPECIFIC economic data for ${location}. All text fields must be plain strings with real data.
Return ONLY valid JSON:
{
  "cost_of_living": "Real cost-of-living summary for ${city} with actual numbers in ${currency}. E.g. housing, grocery, transport monthly costs.",
  "cost_index": <integer 0-100, 100=most affordable>,
  "housing_rent_estimates": "Real average monthly rent in ${city}: studio, 1-bed, 2-bed in ${currency} with neighborhood examples.",
  "housing_index_score": <integer 0-100, 100=most affordable>,
  "median_income": "Real median household income in ${city} in ${currency}. Include poverty rate if known.",
  "employment_indicators": "Real unemployment rate for ${city}. Top 5 real employers or dominant economic sectors by name.",
  "industry_strengths": "Top 5 real industries in ${city}. Name actual companies or organizations present there.",
  "business_environment": "What makes ${city} attractive for business: tax rates, rankings, enterprise zones, government programs — specific facts.",
  "minority_representation": "Real stats on ${minorNote} in ${city}: population %, business ownership %, any notable data.",
  "underrepresented_entrepreneurs_pct": <integer 0-100 estimate>,
  "opportunity_score": <integer 0-100 overall opportunity for underrepresented founders>
}`,

    ecosystem: `Using your training knowledge, fill in REAL business ecosystem data for ${location}. Name actual organizations. All text fields must be plain strings.
Return ONLY valid JSON:
{
  "incubators_accelerators": "2-4 REAL incubator or accelerator names in ${city} with brief description of each. No placeholders.",
  "coworking_spaces": "REAL coworking spaces in ${city}: specific names and neighborhoods. E.g. iHub, Impact Hub, WeWork, local spaces.",
  "startup_hubs": "Primary tech/innovation district or hub in ${city}: name, neighborhood, and what makes it notable.",
  "mentorship_networks": "REAL mentorship programs in ${city}: e.g. SCORE chapter (US), Tony Elumelu Foundation, AfriLabs, local SBDC, specific programs by name.",
  "network_strength": <integer 0-100>,
  "chambers_of_commerce": "Full name and website of the primary Chamber of Commerce for ${city}.",
  "black_business_organizations": "REAL ${minorNote} networks or organizations active in ${city}. Name specific groups.",
  "business_score": <integer 0-100>
}`,

    grants: `Using your training knowledge, name a REAL grant or funding program for entrepreneurs in ${location}. All values must be plain strings.
Return ONLY valid JSON:
{
  "grant_name": "Full name of a REAL existing grant or funding program in ${city} or ${region}",
  "funder": "Full legal name of the real organization offering this grant",
  "eligibility_criteria": "Specific requirements: business type, ownership, industry, revenue cap, location",
  "funding_amount": "Specific amount in ${currency} (e.g. '$5,000-$50,000')",
  "deadline": "Real deadline or cycle (e.g. 'Rolling basis', 'Quarterly')",
  "application_link": "Real URL to the grant application or program page",
  "geographic_scope": "City, country, region, or continent scope",
  "target_audience": "Exactly who qualifies — be specific about ownership type and sector"
}`,

    policy: `Using your training knowledge, fill in REAL policy incentives for ${location}. All values must be plain strings (no arrays, no objects).
Return ONLY valid JSON:
{
  "tax_incentives": "REAL tax incentive programs in ${region} — name each program, rate/amount, and what activity it rewards. Specific facts only.",
  "startup_support_programs": "REAL programs supporting startups in ${city} — names, what they provide (loans, training, grants), who runs them.",
  "minority_business_certifications": "REAL certification programs for ${minorNote} in ${region} — issuing agency, how to apply, what benefits they provide.",
  "government_backed_initiatives": "REAL government or international initiatives in ${city}: SEZs, free trade zones, development bank programs, Opportunity Zones — name them specifically."
}`,

    cost: `Using your training knowledge, fill in SPECIFIC cost data for ${location} with real numbers. All values must be plain strings.
Return ONLY valid JSON:
{
  "living_expenses": "Real monthly cost breakdown for ${city}: rent + groceries + transport + utilities in ${currency}. Give specific amounts and a total range.",
  "business_setup_costs": "Real cost to register a business in ${region}: registration fee, legal fees, local permits in ${currency} with specific amounts.",
  "hiring_costs": "Real minimum wage in ${region} in ${currency}/hr or month, average salary for office/tech workers, employer payroll tax or social contribution rates.",
  "utilities_and_infrastructure": "Real average monthly costs in ${city}: electricity, internet, water+gas in ${currency}. Note internet quality and key providers."
}`,
  };

  return prompts[category];
}

async function aiKnowledgeFallback(city, region, category, isUS = true) {
  return (await aiCall(buildFallbackPrompt(category, city, region, isUS))) || {};
}

// ── Category extractors — strict prompts demand city-specific data ─────────────

async function extractEconomicData(city, region, text, isUS = true) {
  const location = isUS ? `${city}, ${region}, USA` : `${city}, ${region}`;
  const incomeRef = isUS ? "Median household income and per capita income (cite Census year). Include poverty rate." : "Estimated median household income in USD and local currency. Include GDP per capita if available.";
  const employRef = isUS ? "Unemployment rate (cite BLS). Top 5 employers by name with headcount." : "Estimated unemployment rate. Top 5 employers or economic sectors by name.";
  const minorityRef = isUS ? "Black/minority percentage of population (Census). Percentage of minority-owned businesses." : "Percentage of underrepresented entrepreneurs (women, youth, diaspora). Any available stats on minority business ownership.";

  const data = await aiCall(`
You are extracting economic data EXCLUSIVELY for ${location}.
Return ONLY valid JSON. All score fields must be integers 0–100. All text fields must be plain strings (NO arrays, NO nested objects).

{
  "cost_of_living": "Cost-of-living summary for ${city} with real numbers — housing, groceries, utilities, transport costs in local currency and USD.",
  "cost_index": integer 0-100 (100 = most affordable for entrepreneurs),
  "housing_rent_estimates": "Average monthly rent in ${city}: studio, 1BR, 2BR in USD. Name specific neighborhoods.",
  "housing_index_score": integer 0-100 (100 = most affordable housing),
  "median_income": "${incomeRef}",
  "employment_indicators": "${employRef}",
  "industry_strengths": "Top 5 industries in ${city}. Name real companies or organizations present there.",
  "business_environment": "Specific advantages that make ${city} attractive to entrepreneurs: tax rates, rankings, special zones, notable programs.",
  "minority_representation": "${minorityRef}",
  "underrepresented_entrepreneurs_pct": integer 0-100,
  "opportunity_score": integer 0-100 scoring entrepreneurial opportunity for underrepresented founders
}

Web text for ${location}:
${text.slice(0, MAX_TEXT)}
`);

  if (!data || isGeneric(data)) return aiKnowledgeFallback(city, region, "economic", isUS);
  return data;
}

async function extractBusinessEcosystem(city, region, text, isUS = true) {
  const location = isUS ? `${city}, ${region}, USA` : `${city}, ${region}`;
  const mentorRef = isUS
    ? `Full name of the SCORE chapter serving ${city}, local SBDC center, and any notable mentorship programs.`
    : `Key mentorship programs, entrepreneurship support organizations, or international programs (e.g. Tony Elumelu Foundation, AfriLabs, GIZ) active in ${city}.`;
  const blackOrgRef = isUS
    ? `Names of Black-focused business organizations, minority chambers, and professional networks active in ${city}.`
    : `Names of women entrepreneur networks, youth business organizations, and diaspora/international business networks active in ${city}.`;

  const data = await aiCall(`
You are extracting business ecosystem data EXCLUSIVELY for ${location}.
Return ONLY valid JSON. Score fields must be integers 0–100. ALL text fields must be plain strings (NO arrays, NO nested objects).

{
  "incubators_accelerators": "2-4 real incubator or accelerator names operating in ${city} with brief description. Plain string only.",
  "coworking_spaces": "Real coworking spaces in ${city} — specific names and neighborhoods. Plain string only.",
  "startup_hubs": "Primary innovation district or tech hub in ${city}, its location and what makes it notable. Plain string only.",
  "mentorship_networks": "${mentorRef} Plain string only.",
  "network_strength": integer 0-100,
  "chambers_of_commerce": "Full name and website of the primary Chamber of Commerce for ${city}. Plain string only.",
  "black_business_organizations": "${blackOrgRef} Plain string only.",
  "business_score": integer 0-100
}

Web text for ${location}:
${text.slice(0, MAX_TEXT)}
`);

  if (!data || isGeneric(data)) return aiKnowledgeFallback(city, region, "ecosystem", isUS);
  return data;
}

async function extractGrantsFunding(city, region, text, isUS = true) {
  const location = isUS ? `${city}, ${region}, USA` : `${city}, ${region}`;
  const funderHint = isUS
    ? "government agency, nonprofit, or foundation"
    : "government agency, development bank, international donor, or nonprofit (e.g. World Bank, AfDB, Tony Elumelu Foundation, USAID)";

  const data = await aiCall(`
You are extracting grants and funding data for entrepreneurs in ${location}.
Return ONLY valid JSON with plain string values (NO arrays, NO nested objects):

{
  "grant_name": "Full name of a real grant or funding program available in ${city} or ${region}",
  "funder": "Full name of the ${funderHint} offering this grant",
  "eligibility_criteria": "Specific requirements: business type, ownership, industry, revenue cap, years in business",
  "funding_amount": "Specific amount or range in USD (e.g. '$5,000 to $50,000')",
  "deadline": "Application deadline or cycle (e.g. 'Rolling basis', 'Quarterly')",
  "application_link": "Direct URL to the grant application page",
  "geographic_scope": "City, country, regional, or continent-wide scope",
  "target_audience": "Exactly who qualifies — be specific about ownership type and sector"
}

Web text for ${location}:
${text.slice(0, MAX_TEXT)}
`);

  if (!data || isGeneric(data)) return aiKnowledgeFallback(city, region, "grants", isUS);
  return data;
}

async function extractPolicyIncentives(city, region, text, isUS = true) {
  const location = isUS ? `${city}, ${region}, USA` : `${city}, ${region}`;
  const certRef = isUS
    ? `Federal certifications (SBA 8(a), WOSB, HUBZone, SDVOSB) plus ${region}-specific MBE/WBE/DBE programs — include issuing agency and how to apply.`
    : `Business registration and certification programs in ${region} for entrepreneurs — include government-issued licenses, investment promotion agency programs, and any diaspora/women entrepreneur certifications.`;
  const govRef = isUS
    ? `Opportunity Zone tracts in ${city}, CDBG allocation, MBDA Business Center presence, and notable city economic programs.`
    : `Special Economic Zones (SEZ), free trade zones, investment promotion programs, and international development-backed initiatives (World Bank, AfDB, IFC) in ${city} or ${region}.`;

  const data = await aiCall(`
You are extracting policy incentives for businesses in ${location}.
Return ONLY valid JSON with plain string values (NO arrays, NO nested objects):

{
  "tax_incentives": "Real tax incentive programs in ${region} — name each program, credit amount or rate, and what it rewards. Plain string only.",
  "startup_support_programs": "Real programs supporting startups in ${city} — names, what they provide (loans, training, workspace), who runs them. Plain string only.",
  "minority_business_certifications": "${certRef} Plain string only.",
  "government_backed_initiatives": "${govRef} Plain string only."
}

Web text for ${location}:
${text.slice(0, MAX_TEXT)}
`);

  if (!data || isGeneric(data)) return aiKnowledgeFallback(city, region, "policy", isUS);
  return data;
}

async function extractCostData(city, region, text, isUS = true) {
  const location = isUS ? `${city}, ${region}, USA` : `${city}, ${region}`;
  const setupRef = isUS
    ? `LLC filing fee in ${region} (exact $), registered agent fee ($/yr), local business license for ${city} (approx $).`
    : `Business registration costs in ${region} — company registration fee, notary/legal fees, local permits. Include approximate USD amounts.`;
  const hiringRef = isUS
    ? `${region} minimum wage ($/hr), average hourly pay for admin/retail/tech roles in ${city}, employer payroll tax rate.`
    : `Minimum wage in ${region} in local currency and USD equivalent, average monthly salary for office/tech workers, employer social contribution rates.`;

  const data = await aiCall(`
You are extracting cost and relocation data EXCLUSIVELY for ${location}.
Return ONLY valid JSON with plain string values (NO arrays, NO nested objects):

{
  "living_expenses": "Monthly cost breakdown for ${city}: rent + groceries + transport + utilities in USD. Give specific amounts and a total monthly range.",
  "business_setup_costs": "${setupRef} Plain string only.",
  "hiring_costs": "${hiringRef} Plain string only.",
  "utilities_and_infrastructure": "Average monthly costs in ${city}: electricity, internet, water+gas in USD. Note internet quality and key providers. Plain string only."
}

Web text for ${location}:
${text.slice(0, MAX_TEXT)}
`);

  if (!data || isGeneric(data)) return aiKnowledgeFallback(city, region, "cost", isUS);
  return data;
}

// ── City research orchestrator ────────────────────────────────────────────────

async function researchCity(cityData) {
  const {
    city, state, country = "United States", censusSlug, govUrl, chamberUrl, ecosystemUrl,
    grantUrl, stateGovUrl, numbeoCity,
  } = cityData;

  const isUS = country === "United States";
  const region = state || country; // use country as region label for African cities

  const numbeoUrl = `https://www.numbeo.com/cost-of-living/in/${encodeURIComponent(numbeoCity || city)}`;
  const primaryEconUrl = isUS
    ? `https://www.census.gov/quickfacts/${censusSlug}`
    : govUrl;

  console.log(`  [${city}] Searching DuckDuckGo for city-specific pages...`);

  // Targeted DDG searches — adapted for US vs African cities
  const [ecosystemUrls, grantUrls, policyUrls] = await Promise.all([
    searchDDG(`"${city}" "${country}" incubators accelerators coworking startup hub business organizations entrepreneurs`, 3),
    searchDDG(`"${city}" OR "${country}" small business grants minority entrepreneurs funding investment 2024 2025`, 3),
    isUS
      ? searchDDG(`"${region}" business tax credits incentives startup programs economic development`, 2)
      : searchDDG(`"${country}" investment incentives tax holiday SEZ special economic zone entrepreneur`, 2),
  ]);

  console.log(`  [${city}] Fetching authoritative pages...`);

  const [econText, ecosystemText, grantText, policyText, costText] = await Promise.all([
    fetchMany([primaryEconUrl, govUrl].filter(Boolean)),
    fetchMany([chamberUrl, ecosystemUrl, ...ecosystemUrls].filter(Boolean)),
    isUS
      ? fetchMany([grantUrl, ...grantUrls, "https://www.sba.gov/funding-programs/grants", "https://mbda.gov/resources/grants"].filter(Boolean))
      : fetchMany([grantUrl, ...grantUrls].filter(Boolean)),
    fetchMany([govUrl, stateGovUrl, ...policyUrls].filter(Boolean)),
    fetchMany([numbeoUrl, govUrl].filter(Boolean)),
  ]);

  console.log(`  [${city}] Extracting city-specific data...`);

  const [economic, ecosystem, grants, policy, cost] = await Promise.all([
    extractEconomicData(city, region, econText, isUS),
    extractBusinessEcosystem(city, region, ecosystemText, isUS),
    extractGrantsFunding(city, region, grantText, isUS),
    extractPolicyIncentives(city, region, policyText, isUS),
    extractCostData(city, region, costText, isUS),
  ]);

  // t() = text field: must not be a bare number
  // sc() = score field: must be integer 1-100
  const t  = ensureText;
  const sc = ensureScore;

  const profile = {
    city,
    state: isUS ? state : "",
    country,
    primarySourceUrl: govUrl || primaryEconUrl,

    // CITY ECONOMIC DATA
    cost_of_living:                     t(economic.cost_of_living),
    cost_index:                        sc(economic.cost_index),
    housing_rent_estimates:             t(economic.housing_rent_estimates),
    housing_index_score:               sc(economic.housing_index_score),
    median_income:                      t(economic.median_income),
    employment_indicators:              t(economic.employment_indicators),
    industry_strengths:                 t(economic.industry_strengths),
    business_environment:               t(economic.business_environment),
    minority_representation:            t(economic.minority_representation),
    underrepresented_entrepreneurs_pct: sc(economic.underrepresented_entrepreneurs_pct),
    opportunity_score:                  sc(economic.opportunity_score),

    // BUSINESS ECOSYSTEM
    incubators_accelerators:      t(ecosystem.incubators_accelerators),
    coworking_spaces:             t(ecosystem.coworking_spaces),
    startup_hubs:                 t(ecosystem.startup_hubs),
    mentorship_networks:          t(ecosystem.mentorship_networks),
    network_strength:            sc(ecosystem.network_strength),
    chambers_of_commerce:         t(ecosystem.chambers_of_commerce),
    black_business_organizations: t(ecosystem.black_business_organizations),
    business_score:              sc(ecosystem.business_score),

    // GRANTS & FUNDING
    grant_name:           t(grants.grant_name),
    funder:               t(grants.funder),
    eligibility_criteria: t(grants.eligibility_criteria),
    funding_amount:       t(grants.funding_amount),
    deadline:             t(grants.deadline),
    application_link:     t(grants.application_link),
    geographic_scope:     t(grants.geographic_scope),
    target_audience:      t(grants.target_audience),

    // POLICY INCENTIVES
    tax_incentives:                   t(policy.tax_incentives),
    startup_support_programs:         t(policy.startup_support_programs),
    minority_business_certifications: t(policy.minority_business_certifications),
    government_backed_initiatives:    t(policy.government_backed_initiatives),

    // COST & RELOCATION
    living_expenses:              t(cost.living_expenses),
    business_setup_costs:         t(cost.business_setup_costs),
    hiring_costs:                 t(cost.hiring_costs),
    utilities_and_infrastructure: t(cost.utilities_and_infrastructure),
  };

  // Fill any remaining empty/invalid fields with AI knowledge
  await fillMissingFields(city, region, profile, isUS);

  // Final type enforcement pass — fixes any AI-fallback type mismatches
  for (const [key, val] of Object.entries(profile)) {
    if (SCORE_FIELDS.has(key)) {
      profile[key] = ensureScore(val);
    } else if (typeof val === "string") {
      profile[key] = ensureText(val);
    }
  }

  return profile;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const citiesFile = process.argv[2] || "target_cities.json";
let cities;
try {
  cities = JSON.parse(readFileSync(citiesFile, "utf-8"));
} catch {
  console.error(`Cannot read ${citiesFile}. Run from the faro_AI_web_research_agent directory.`);
  process.exit(1);
}

console.log(`\nFaro City Profile Agent`);
console.log(`Model : ${MODEL}`);
console.log(`Cities: ${cities.length}`);

// ── Pre-load existing sheet rows ──────────────────────────────────────────────
console.log(`\nChecking Google Sheet for existing rows...`);
let existingMap = new Map();
try {
  const rows     = await getSheetRows();
  const complete = rows.filter(r => r.isComplete).length;
  console.log(`  ${rows.length} existing rows — ${complete} complete, ${rows.length - complete} incomplete`);
  for (const row of rows) existingMap.set(row.city.toLowerCase(), row);
} catch (err) {
  console.warn(`  Could not read sheet (${err.message}). Treating all cities as new.`);
}
console.log();

let written = 0, skipped = 0, failed = 0;

for (let i = 0; i < cities.length; i += CONCURRENCY) {
  const batch = cities.slice(i, i + CONCURRENCY);

  await Promise.all(batch.map(async (cityData, idx) => {
    const num      = i + idx + 1;
    const cityKey  = cityData.city.toLowerCase();
    const existing = existingMap.get(cityKey);

    // Already fully filled — skip
    if (existing?.isComplete) {
      console.log(`[${num}/${cities.length}] ✓ Skipped : ${cityData.city} — all columns filled`);
      skipped++;
      return;
    }

    try {
      const action = existing ? `↻ Updating row ${existing.rowNumber}` : "+ Adding new row";
      const location = cityData.country && cityData.country !== "United States"
        ? `${cityData.city}, ${cityData.country}`
        : `${cityData.city}, ${cityData.state}`;
      console.log(`[${num}/${cities.length}] ${action}: ${location}`);

      const profile = await researchCity(cityData);

      if (existing) {
        await updateCityProfileRow(existing.rowNumber, profile);
      } else {
        await appendCityProfileRow(profile);
      }

      written++;
      console.log(`[${num}/${cities.length}] ✓ Done    : ${cityData.city}`);
    } catch (err) {
      failed++;
      console.error(`[${num}/${cities.length}] ✗ Failed  : ${cityData.city} — ${err.message}`);
    }
  }));
}

console.log(`\nDone — written/updated: ${written}, skipped (complete): ${skipped}, failed: ${failed}`);
process.exit(0);
