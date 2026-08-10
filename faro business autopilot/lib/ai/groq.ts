import "server-only";
import { z } from "zod";

const leadScoreSchema = z.object({
  score: z.number().min(0).max(100),
  lead_type: z.enum(["customer", "partner", "fellowship", "funder", "supplier", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type LeadScoreResult = z.infer<typeof leadScoreSchema>;

const SYSTEM_PROMPT = `You are the Lead Qualification agent for FARO, a platform that helps
entrepreneurs and organizations with city recommendations, grants, market-entry
intelligence, and a diaspora business fellowship program.

Score the lead's fit and buying intent from 0-100, classify what type of lead
they are, assign a priority, and give a confidence level for your assessment.
Base this only on the information given — do not invent facts. Respond with
JSON matching this exact shape:
{"score": number, "lead_type": "customer"|"partner"|"fellowship"|"funder"|"supplier"|"other", "priority": "low"|"medium"|"high"|"urgent", "confidence": number, "reasoning": string}`;

export async function scoreLead(input: {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  message?: string;
  sourceCode?: string;
}): Promise<LeadScoreResult> {
  const userContent = [
    `Name: ${input.firstName} ${input.lastName}`,
    input.jobTitle ? `Job title: ${input.jobTitle}` : null,
    input.sourceCode ? `Source: ${input.sourceCode}` : null,
    input.message ? `Message: ${input.message}` : "Message: (none provided)",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq scoring failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  const raw = JSON.parse(body.choices[0].message.content);
  // Models don't reliably stick to a 0-1 range for confidence despite the
  // prompt — normalize a 0-100 value down rather than fail the whole score.
  if (typeof raw.confidence === "number" && raw.confidence > 1) {
    raw.confidence = raw.confidence / 100;
  }

  const parsed = leadScoreSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Groq returned an unexpected shape: ${parsed.error.message}`);
  }
  return parsed.data;
}
