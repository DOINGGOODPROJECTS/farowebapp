import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });
dotenv.config({ path: join(__dirname, "../.env") });

// Ollama OpenAI-compatible client for embeddings
const openai = new OpenAI({ baseURL: "http://localhost:11434/v1", apiKey: "ollama" });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

const COLLECTION  = process.env.QDRANT_COLLECTION || "faro_records";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

/**
 * Semantic search against the Qdrant collection.
 * @param {string} query - Natural language query from the user.
 * @param {object} options
 * @param {number}  options.limit   - Max results to return (default 6).
 * @param {string}  options.city    - Optional city filter.
 * @param {string}  options.state   - Optional state filter.
 * @param {string}  options.category - Optional category filter.
 * @returns {Promise<Array>} Qdrant search results with id + payload.
 */
export async function semanticSearch(query, { limit = 6, city, state, category } = {}) {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: query,
  });

  const queryVector = res.data[0].embedding;

  // Build optional payload filter
  const mustClauses = [];

  if (city) {
    mustClauses.push({ key: "city", match: { value: city } });
  }
  if (state) {
    mustClauses.push({ key: "state", match: { value: state } });
  }
  if (category) {
    mustClauses.push({ key: "category", match: { value: category } });
  }

  const searchParams = {
    vector:        queryVector,
    limit,
    with_payload:  true,
    with_vectors:  false,
  };

  if (mustClauses.length > 0) {
    searchParams.filter = { must: mustClauses };
  }

  return qdrant.search(COLLECTION, searchParams);
}
