import "server-only";

export async function notifyLeadScored(input: {
  leadId: string;
  contactId: string;
  twentyPersonId: string | null;
  firstName: string;
  lastName: string;
  score: number;
  priority: string;
  leadType: string;
  reasoning: string;
}) {
  const res = await fetch(process.env.N8N_LEAD_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Faro-Secret": process.env.N8N_LEAD_WEBHOOK_SECRET!,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`n8n lead-scored webhook failed: ${res.status} ${await res.text()}`);
  }
}
