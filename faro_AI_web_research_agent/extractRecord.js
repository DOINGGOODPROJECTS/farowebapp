import OpenAI from "openai";
import dotenv from "dotenv";
import { z } from "zod";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config();

const useHermes = process.env.USE_HERMES === "true";

const client = useHermes
  ? new OpenAI({
      baseURL: "http://localhost:11434/v1",
      apiKey:  "ollama",
    })
  : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RecordSchema = z.object({
  category: z.enum([
    "city_economic_data",
    "business_ecosystem",
    "grants_funding",
    "policy_incentives",
    "cost_relocation_data",
  ]),
  title:            z.string(),
  location:         z.string().nullable(),
  city:             z.string().nullable(),
  state:            z.string().nullable(),
  country:          z.string().nullable(),
  description:      z.string().nullable(),
  data:             z.record(z.any()),
  source_url:       z.string(),
  source_name:      z.string().nullable(),
  confidence_score: z.number().min(0).max(100),
  confidence_level: z.enum(["high", "medium", "low"]),
  status:           z.enum(["active", "expired", "needs_review", "rejected"]),
});

const VALID_CATEGORIES = [
  "city_economic_data",
  "business_ecosystem",
  "grants_funding",
  "policy_incentives",
  "cost_relocation_data",
];

function cleanJson(raw) {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function sanitize(obj) {
  if (!VALID_CATEGORIES.includes(obj.category)) {
    obj.category = "city_economic_data";
    obj.status = "needs_review";
    if (obj.confidence_score > 60) obj.confidence_score = 60;
    obj.confidence_level = "low";
  }
  return obj;
}

export async function extractRecordFromText({ pageTitle, text, sourceUrl }) {
  const prompt = `
You are the Faro AI Web-Research Dataset Agent.

Faro helps underrepresented entrepreneurs compare US cities, discover grants, understand business ecosystems, and make relocation or expansion decisions.

Extract ONE structured dataset record from the webpage below.

STRICT LOCATION RULES:
- Only extract records related to a city in the United States.
- city field must contain a US city name.
- state field must contain a valid full US state name (e.g. "Georgia", not "GA").
- country field must be exactly "United States".
- If the page has no clear US city context, set status to "rejected".
- Never extract data about non-US locations.

Allowed categories:

1. city_economic_data — cost_of_living, housing_rent_estimates, median_income, employment_indicators, industry_strengths, business_environment, demographics.minority_representation
2. business_ecosystem — incubators_accelerators, coworking_spaces, startup_hubs, mentorship_networks, chambers_of_commerce, black_business_organizations
3. grants_funding — grant_name, funder, eligibility_criteria, funding_amount, deadline, application_link, geographic_scope, target_audience
4. policy_incentives — tax_incentives, startup_support_programs, minority_business_certifications, government_backed_initiatives
5. cost_relocation_data — living_expenses, business_setup_costs, hiring_costs, utilities_and_infrastructure

Rules:
- Never invent data. Only use facts from the page text.
- Use null for missing scalar fields.
- Use [] for missing list fields.
- confidence_score below 80 → status must be "needs_review".
- confidence_score 80 or above → status may be "active".
- Return only valid JSON. No markdown. No explanation.

Return exactly this JSON structure:
{
  "category": "city_economic_data",
  "title": "",
  "location": null,
  "city": null,
  "state": null,
  "country": "United States",
  "description": null,
  "data": {},
  "source_url": "${sourceUrl}",
  "source_name": null,
  "confidence_score": 0,
  "confidence_level": "low",
  "status": "needs_review"
}

Page title:
${pageTitle}

Page text:
${text}
`.trim();

  const model = useHermes
    ? (process.env.HERMES_MODEL || "hermes3:3b")
    : (process.env.OPENAI_MODEL  || "gpt-4o-mini");

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = cleanJson(response.choices[0].message.content);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI returned non-JSON: ${raw.slice(0, 200)}`);
  }

  return RecordSchema.parse(sanitize(parsed));
}
