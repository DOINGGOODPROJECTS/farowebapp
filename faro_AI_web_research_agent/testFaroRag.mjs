import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: "/home/bright/Desktop/farowebapp/faro_AI_web_research_agent/.env.local" });

import { queryFaro } from "/home/bright/Desktop/farowebapp/faro_AI_web_research_agent/rag/faroChat.js";

console.log("🔍 Testing Faro RAG — loading city profiles from Google Sheet...\n");

const result = await queryFaro(
  "What is the best US city for a Black entrepreneur to start a tech startup with a limited budget?",
  [],
  {}
);

console.log("═══════════════════════════════════════════════");
console.log("FARO AI RESPONSE");
console.log("═══════════════════════════════════════════════");
console.log(result.answer);
console.log("\n───────────────────────────────────────────────");
console.log(`Dataset used: ${result.recordCount} city profile(s)`);
if (result.recordCount > 0) {
  console.log("Cities referenced:", result.sources.map(s => `${s.city}, ${s.state}`).join(" | "));
}
console.log("═══════════════════════════════════════════════");
