import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });
dotenv.config({ path: join(__dirname, "../.env") });

// Ollama OpenAI-compatible client for embeddings
const openai  = new OpenAI({ baseURL: "http://localhost:11434/v1", apiKey: "ollama" });
const qdrant  = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333", checkCompatibility: false });

const COLLECTION   = process.env.QDRANT_COLLECTION || "faro_records";
const EMBED_MODEL  = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const VECTOR_SIZE  = 768;

// Build a rich text representation of a record for embedding
export function recordToText(record) {
  const data = typeof record.data === "string"
    ? JSON.parse(record.data)
    : (record.data || {});

  return [
    record.title,
    record.category?.replace(/_/g, " "),
    [record.city, record.state].filter(Boolean).join(", "),
    record.description,
    JSON.stringify(data).slice(0, 2000),
  ]
    .filter(Boolean)
    .join(" | ");
}

let _collectionReady = false;

export async function ensureCollection() {
  if (_collectionReady) return;
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log(`Created Qdrant collection: ${COLLECTION}`);
  }
  _collectionReady = true;
}

export async function embedAndUpsert(recordId, record) {
  await ensureCollection();

  const text = recordToText(record);

  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });

  const vector = res.data[0].embedding;

  await qdrant.upsert(COLLECTION, {
    points: [
      {
        id: recordId,
        vector,
        payload: {
          category:         record.category,
          city:             record.city,
          state:            record.state,
          title:            record.title,
          status:           record.status,
          confidence_level: record.confidence_level,
        },
      },
    ],
  });
}
