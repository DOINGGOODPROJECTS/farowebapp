/**
 * faroChat.js — Faro AI Chat powered by the Google Sheet.
 *
 * The Google Sheet (FARO_DATASET) is the single source of truth.
 * When a user asks a question:
 *   1. Load all city profiles from the sheet
 *   2. Find the most relevant profiles (by city name, state, or keyword)
 *   3. Inject matching profiles as context into the AI prompt
 *   4. AI answers using only that real, researched data
 *
 * Export:  queryFaro(question, history, filters)
 * CLI:     node rag/faroChat.js
 */

import OpenAI    from "openai";
import readline  from "readline";
import dotenv    from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readAllCityProfiles } from "../googleSheets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });
dotenv.config({ path: join(__dirname, "../.env") });

const useHermes = process.env.USE_HERMES === "true";
const client = useHermes
  ? new OpenAI({ baseURL: "http://localhost:11434/v1", apiKey: "ollama" })
  : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = useHermes
  ? (process.env.HERMES_MODEL || "hermes3:3b")
  : (process.env.OPENAI_MODEL || "gpt-4o-mini");

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Faro, an AI advisor for underrepresented entrepreneurs — especially Black, minority, and first-generation founders.

You help entrepreneurs make data-backed decisions about:
- Choosing the best US city to start or grow their business
- Discovering grants and funding opportunities
- Understanding local business ecosystems and support networks
- Evaluating relocation costs and logistics
- Navigating policy incentives and certifications

Your response style:
- Concise and actionable — no fluff
- Lead with the most important insight
- Use ONLY the city data provided in the context below as your source of truth
- Never invent numbers, deadlines, programs, or organizations not in the context
- For city comparisons, use a clear side-by-side structure
- End every answer with 1-2 concrete next steps

If the user's question is unclear or needs a city/budget/industry to answer well, ask exactly one clarifying question.`;

// ── Find relevant city profiles for a question ────────────────────────────────

function findRelevantProfiles(question, profiles) {
  const q = question.toLowerCase();

  // 1. Direct city name matches
  const cityMatches = profiles.filter(p =>
    p["City"] && q.includes(p["City"].toLowerCase())
  );
  if (cityMatches.length > 0) return cityMatches;

  // 2. State name matches
  const stateMatches = profiles.filter(p =>
    p["State"] && q.includes(p["State"].toLowerCase())
  );
  if (stateMatches.length > 0) return stateMatches;

  // 3. Category keyword matches — return all profiles so AI can compare
  const categoryKeywords = [
    "grant", "funding", "money", "loan",
    "cost", "rent", "living", "afford", "cheap", "expensive",
    "business", "ecosystem", "incubator", "accelerator", "coworking",
    "tax", "incentive", "policy", "zone",
    "hire", "hiring", "wage", "salary",
    "minority", "black", "underrepresented", "women",
    "best city", "compare", "which city", "top city",
  ];

  const isComparison = categoryKeywords.some(k => q.includes(k));
  if (isComparison) return profiles;

  // 4. Default — return all profiles
  return profiles;
}

// ── Build context string from profiles ───────────────────────────────────────

function buildContext(profiles) {
  if (!profiles.length) {
    return "No city data is currently available in the Faro dataset. The research agent may not have run yet.";
  }

  return profiles.map((p, i) => {
    const lines = [
      `--- City ${i + 1}: ${p["City"]}, ${p["State"]} ---`,
    ];

    // Economic
    if (p["Cost of Living"])            lines.push(`Cost of Living: ${p["Cost of Living"]}`);
    if (p["Housing & Rent Estimates"])  lines.push(`Housing & Rent: ${p["Housing & Rent Estimates"]}`);
    if (p["Median Income"])             lines.push(`Median Income: ${p["Median Income"]}`);
    if (p["Employment Indicators"])     lines.push(`Employment: ${p["Employment Indicators"]}`);
    if (p["Industry Strengths"])        lines.push(`Industries: ${p["Industry Strengths"]}`);
    if (p["Business Environment"])      lines.push(`Business Environment: ${p["Business Environment"]}`);
    if (p["Minority Representation (%)"]) lines.push(`Minority Representation: ${p["Minority Representation (%)"]}`);

    // Business ecosystem
    if (p["Incubators & Accelerators"]) lines.push(`Incubators/Accelerators: ${p["Incubators & Accelerators"]}`);
    if (p["Coworking Spaces"])          lines.push(`Coworking Spaces: ${p["Coworking Spaces"]}`);
    if (p["Startup Hubs"])              lines.push(`Startup Hubs: ${p["Startup Hubs"]}`);
    if (p["Mentorship Networks"])       lines.push(`Mentorship: ${p["Mentorship Networks"]}`);
    if (p["Chambers of Commerce"])      lines.push(`Chamber of Commerce: ${p["Chambers of Commerce"]}`);
    if (p["Black Business Organizations"]) lines.push(`Black Business Orgs: ${p["Black Business Organizations"]}`);

    // Grants
    if (p["Grant Name"])            lines.push(`Grant: ${p["Grant Name"]}`);
    if (p["Funder"])                lines.push(`Funder: ${p["Funder"]}`);
    if (p["Eligibility Criteria"])  lines.push(`Eligibility: ${p["Eligibility Criteria"]}`);
    if (p["Funding Amount"])        lines.push(`Funding Amount: ${p["Funding Amount"]}`);
    if (p["Deadline"])              lines.push(`Deadline: ${p["Deadline"]}`);
    if (p["Application Link"])      lines.push(`Apply: ${p["Application Link"]}`);
    if (p["Target Audience"])       lines.push(`Target Audience: ${p["Target Audience"]}`);

    // Policy
    if (p["Tax Incentives"])                    lines.push(`Tax Incentives: ${p["Tax Incentives"]}`);
    if (p["Startup Support Programs"])          lines.push(`Startup Programs: ${p["Startup Support Programs"]}`);
    if (p["Minority Business Certifications"])  lines.push(`Certifications: ${p["Minority Business Certifications"]}`);
    if (p["Government-Backed Initiatives"])     lines.push(`Gov Initiatives: ${p["Government-Backed Initiatives"]}`);

    // Cost
    if (p["Living Expenses"])             lines.push(`Living Expenses: ${p["Living Expenses"]}`);
    if (p["Business Setup Costs"])        lines.push(`Business Setup: ${p["Business Setup Costs"]}`);
    if (p["Hiring Costs"])                lines.push(`Hiring Costs: ${p["Hiring Costs"]}`);
    if (p["Utilities & Infrastructure"])  lines.push(`Utilities: ${p["Utilities & Infrastructure"]}`);

    return lines.join("\n");
  }).join("\n\n");
}

// ── Core RAG query — callable from Faro backend ──────────────────────────────

/**
 * @param {string} question   — user's message
 * @param {Array}  history    — [{role, content}] prior conversation turns
 * @param {object} filters    — optional { city, state } to pre-filter profiles
 * @returns {Promise<{answer, sources, recordCount}>}
 */
export async function queryFaro(question, history = [], filters = {}) {
  // 1. Load all city profiles from the Google Sheet
  let profiles = await readAllCityProfiles();

  // 2. Apply hard filters if provided (e.g. from a UI city picker)
  if (filters.city)  profiles = profiles.filter(p => p["City"]?.toLowerCase()  === filters.city.toLowerCase());
  if (filters.state) profiles = profiles.filter(p => p["State"]?.toLowerCase() === filters.state.toLowerCase());

  // 3. Find the most relevant profiles for this question
  const relevant = findRelevantProfiles(question, profiles);

  // 4. Build context from the relevant profiles
  const context = buildContext(relevant);

  // 5. Build messages
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `FARO DATASET — city profiles from the Google Sheet (use this as your only source of truth):\n\n${context}`,
    },
    ...history.slice(-20),
    { role: "user", content: question },
  ];

  // 6. Generate answer
  const response = await client.chat.completions.create({
    model:       MODEL,
    messages,
    temperature: 0.3,
    max_tokens:  1200,
  });

  const answer = response.choices[0].message.content;

  return {
    answer,
    sources:     relevant.map(p => ({ city: p["City"], state: p["State"] })),
    recordCount: relevant.length,
  };
}

// ── Interactive CLI for local testing ────────────────────────────────────────
if (process.argv[1].endsWith("faroChat.js")) {
  console.log("Faro AI Chat — reads directly from the Google Sheet\n");
  console.log("Loading city profiles from sheet...");

  const profiles = await readAllCityProfiles();
  console.log(`  ${profiles.length} city profiles loaded\n`);

  if (profiles.length === 0) {
    console.log("No data found. Run  npm run city-profiles  first to populate the sheet.");
    process.exit(0);
  }

  const rl      = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history = [];

  const ask = () => {
    rl.question("You: ", async (input) => {
      const line = input.trim();
      if (!line) return ask();
      if (line.toLowerCase() === "exit") { rl.close(); process.exit(0); }

      try {
        const { answer, sources, recordCount } = await queryFaro(line, history);

        console.log(`\nFaro: ${answer}`);
        if (recordCount > 0) {
          console.log(`\n[Based on ${recordCount} city profile(s): ${sources.map(s => s.city).join(", ")}]`);
        }
        console.log();

        history.push({ role: "user",      content: line });
        history.push({ role: "assistant", content: answer });
        if (history.length > 20) history.splice(0, 2);
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }

      ask();
    });
  };

  ask();
}
