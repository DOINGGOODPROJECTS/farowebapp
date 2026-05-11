import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant  = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

const COLLECTION   = process.env.QDRANT_COLLECTION || "faro_records";
const EMBED_MODEL  = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const VECTOR_SIZE  = 1536;

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

export async function ensureCollection() {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION);

  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log(`Created Qdrant collection: ${COLLECTION}`);
  }
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
