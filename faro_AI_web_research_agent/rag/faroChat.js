import OpenAI from "openai";
import readline from "readline";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { db }             from "../db.js";
import { semanticSearch } from "./vectorSearch.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
- Use the provided dataset context as your primary source of truth
- If a fact is not in the context, say you don't have current data and suggest where to check
- Never invent numbers, deadlines, or programs — only cite what is in the context
- For city comparisons, use a clear side-by-side structure
- End every answer with 1-2 concrete next steps

If the user's question is unclear or needs a city/budget/industry to answer well, ask exactly one clarifying question.`;

function buildContext(records) {
  if (!records.length) {
    return "No matching records found in the Faro dataset for this query.";
  }

  return records
    .map((r, i) => {
      const data = typeof r.data === "string" ? JSON.parse(r.data) : (r.data || {});
      return [
        `--- Source ${i + 1} ---`,
        `Category:   ${r.category}`,
        `Title:      ${r.title}`,
        `Location:   ${r.city}, ${r.state}`,
        `Description:${r.description || "N/A"}`,
        `Data:       ${JSON.stringify(data, null, 2)}`,
        `URL:        ${r.source_url}`,
        `Confidence: ${r.confidence_level} (${r.confidence_score}/100)`,
        `Verified:   ${r.last_verified}`,
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Core RAG query function — callable from the Faro backend chat API.
 *
 * @param {string} question      - User's message.
 * @param {Array}  history       - [{role, content}] prior turns (max ~10 pairs).
 * @param {object} filters       - Optional Qdrant filters: { city, state, category }.
 * @returns {Promise<{answer, sources, recordCount}>}
 */
export async function queryFaro(question, history = [], filters = {}) {
  // 1. Semantic search for relevant records
  const searchResults = await semanticSearch(question, { limit: 6, ...filters });
  const recordIds     = searchResults.map((r) => r.id);

  let records = [];
  if (recordIds.length > 0) {
    const placeholders = recordIds.map(() => "?").join(", ");
    const [rows] = await db.query(
      `SELECT id, category, title, city, state, country,
              description, data, source_url,
              confidence_level, confidence_score, last_verified
       FROM   faro_dataset_records
       WHERE  id IN (${placeholders}) AND status = 'active'`,
      recordIds
    );
    records = rows;
  }

  const context = buildContext(records);

  // 2. Build message list
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Dataset context (use this as ground truth):\n\n${context}` },
    ...history.slice(-20),
    { role: "user", content: question },
  ];

  // 3. Generate answer
  const response = await openai.chat.completions.create({
    model:       MODEL,
    messages,
    temperature: 0.3,
    max_tokens:  1200,
  });

  const answer = response.choices[0].message.content;

  return {
    answer,
    sources:     records.map((r) => ({ id: r.id, title: r.title, url: r.source_url })),
    recordCount: records.length,
  };
}

// ── Interactive CLI for local testing ────────────────────────────────────────
if (process.argv[1].endsWith("faroChat.js")) {
  const rl      = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history = [];

  console.log("Faro AI Chat  (RAG-powered)  —  type 'exit' to quit\n");

  const ask = () => {
    rl.question("You: ", async (input) => {
      const line = input.trim();

      if (!line) return ask();
      if (line.toLowerCase() === "exit") { rl.close(); process.exit(0); }

      try {
        const { answer, sources, recordCount } = await queryFaro(line, history);

        console.log(`\nFaro: ${answer}`);

        if (sources.length > 0) {
          console.log(`\n[${recordCount} dataset records used]`);
          sources.forEach((s) => console.log(`  - ${s.title}  ${s.url}`));
        } else {
          console.log("\n[No dataset records matched — answer based on general knowledge]");
        }

        history.push({ role: "user",      content: line });
        history.push({ role: "assistant", content: answer });

        if (history.length > 20) history.splice(0, 2);
        console.log();
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }

      ask();
    });
  };

  ask();
}
