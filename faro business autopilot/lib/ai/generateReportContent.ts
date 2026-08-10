import "server-only";
import { z } from "zod";

const sectionSchema = z.object({
  section_key: z.string(),
  title: z.string(),
  content: z.string(),
});

const reportContentSchema = z.object({
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  sections: z.array(sectionSchema).min(1),
});

export type ReportContent = z.infer<typeof reportContentSchema>;

const SECTION_ORDER = [
  "executive_summary",
  "market_potential",
  "cost_considerations",
  "funding_opportunities",
  "business_ecosystem",
  "risks",
  "recommendations",
] as const;

const SYSTEM_PROMPT = `You are FARO's Report Generation agent. You write a City Opportunity
Report: an analysis of how good a fit a specific city is for a specific
type of business.

Write exactly these sections, in this order, using these exact section_key
values: ${SECTION_ORDER.join(", ")}.

- executive_summary: 2-3 sentence overview and a clear verdict on fit.
- market_potential: demand signals, target market size, growth trends for this business type in this city.
- cost_considerations: relative cost of doing business (rent, labor, taxes) — qualitative if exact figures aren't known.
- funding_opportunities: general categories of funding/grants likely relevant (be general if specific programs aren't known — do not invent named grant programs).
- business_ecosystem: relevant industry clusters, notable local business community factors.
- risks: 2-4 concrete risks or open questions a founder should investigate before committing.
- recommendations: 2-4 concrete next steps.

Ground everything in general, defensible reasoning. Do not invent specific
statistics, named organizations, or named grant programs you're not certain
about — describe categories and general reasoning instead. Respond with
JSON matching exactly:
{"summary": string, "confidence": number (0-1), "sections": [{"section_key": string, "title": string, "content": string}]}`;

export async function generateReportContent(input: {
  city: string;
  businessType: string;
  additionalContext?: string;
}): Promise<ReportContent> {
  const userContent = [
    `City: ${input.city}`,
    `Business type: ${input.businessType}`,
    input.additionalContext ? `Additional context: ${input.additionalContext}` : null,
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
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq report generation failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  const raw = JSON.parse(body.choices[0].message.content);
  if (typeof raw.confidence === "number" && raw.confidence > 1) {
    raw.confidence = raw.confidence / 100;
  }

  const parsed = reportContentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Groq returned an unexpected report shape: ${parsed.error.message}`);
  }
  return parsed.data;
}
