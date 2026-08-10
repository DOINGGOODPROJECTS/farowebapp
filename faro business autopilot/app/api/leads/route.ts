import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreatePerson, addNoteToPerson } from "@/lib/crm/twenty";
import { scoreLead } from "@/lib/ai/groq";
import { notifyLeadScored } from "@/lib/n8n/notifyLeadScored";

const leadSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  jobTitle: z.string().max(160).optional(),
  message: z.string().max(4000).optional(),
  sourceCode: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = leadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const supabase = createAdminClient();

  let sourceId: string | null = null;
  if (input.sourceCode) {
    const { data: source } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("code", input.sourceCode)
      .maybeSingle();
    sourceId = source?.id ?? null;
  }

  let contact: { id: string; metadata: Record<string, unknown> } | null = null;
  if (input.email) {
    const { data } = await supabase
      .from("contacts")
      .select("id, metadata")
      .eq("email", input.email)
      .maybeSingle();
    contact = data;
  }

  let twentyPersonId: string | null = null;
  try {
    const person = await findOrCreatePerson({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      jobTitle: input.jobTitle,
    });
    twentyPersonId = person.id;
    if (input.message) {
      await addNoteToPerson(person.id, `Inquiry from ${input.firstName} ${input.lastName}`, input.message);
    }
  } catch (err) {
    // Twenty CRM being unreachable should not block capturing the lead in Supabase.
    console.error("Twenty CRM sync failed:", err);
  }

  if (!contact) {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        job_title: input.jobTitle,
        source_id: sourceId,
        metadata: twentyPersonId ? { twenty_person_id: twentyPersonId } : {},
      })
      .select("id, metadata")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    contact = created;
  } else if (twentyPersonId && contact.metadata?.twenty_person_id !== twentyPersonId) {
    await supabase
      .from("contacts")
      .update({ metadata: { ...contact.metadata, twenty_person_id: twentyPersonId } })
      .eq("id", contact.id);
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      contact_id: contact.id,
      source_id: sourceId,
      lead_type: "customer",
      title: `${input.firstName} ${input.lastName}`,
      description: input.message,
      status: "new",
      stage: "captured",
    })
    .select("id")
    .single();

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  let scoreResult: Awaited<ReturnType<typeof scoreLead>> | null = null;
  try {
    scoreResult = await scoreLead({
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle,
      message: input.message,
      sourceCode: input.sourceCode,
    });

    await supabase.from("lead_scores").insert({
      lead_id: lead.id,
      score: scoreResult.score,
      scoring_model: `groq/${process.env.GROQ_MODEL}`,
      factors: { reasoning: scoreResult.reasoning },
      confidence: scoreResult.confidence,
    });

    await supabase
      .from("leads")
      .update({
        score: scoreResult.score,
        priority: scoreResult.priority,
        lead_type: scoreResult.lead_type,
        stage: "scored",
      })
      .eq("id", lead.id);
  } catch (err) {
    // Scoring is a nice-to-have on top of capture — a Groq/parsing failure
    // should not block the lead from being captured.
    console.error("Lead scoring failed:", err);
  }

  if (scoreResult) {
    try {
      await notifyLeadScored({
        leadId: lead.id,
        contactId: contact.id,
        twentyPersonId,
        firstName: input.firstName,
        lastName: input.lastName,
        score: scoreResult.score,
        priority: scoreResult.priority,
        leadType: scoreResult.lead_type,
        reasoning: scoreResult.reasoning,
      });
    } catch (err) {
      console.error("n8n lead-scored notification failed:", err);
    }
  }

  return NextResponse.json({
    leadId: lead.id,
    contactId: contact.id,
    twentyPersonId,
    score: scoreResult,
  });
}
