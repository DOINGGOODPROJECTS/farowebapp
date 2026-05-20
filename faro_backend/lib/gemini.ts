import OpenAI from 'openai';
import { buildRagContext } from './sheetRag';

const SYSTEM_INSTRUCTION = `You are Faro, an AI advisor for underrepresented entrepreneurs (Black founders, minority-owned businesses, women entrepreneurs) in the US. Help them decide where to start/grow their business: cities, grants, ecosystems, costs, tax incentives. Use the FARO DATASET when provided — cite numbers and names directly. Supplement with general knowledge when needed. Be concise, actionable, specific. Return plain text or markdown only.`.trim();

export type UserProfile = {
  industry?: string | null;
  stage?: string | null;
  budgetRange?: string | null;
  relocationWindow?: string | null;
  priorities?: string | null;
  currentLocation?: string | null;
};

export type ConversationTurn = {
  role: 'user' | 'model';
  text: string;
};

function buildSystemInstruction(profile: UserProfile, ragContext = ''): string {
  const parts: string[] = [SYSTEM_INSTRUCTION];

  const hasProfile =
    profile.industry || profile.stage || profile.budgetRange ||
    profile.relocationWindow || profile.priorities || profile.currentLocation;

  if (hasProfile) {
    parts.push(`\nUser profile:\n` + [
      `- Industry: ${profile.industry || 'Not provided'}`,
      `- Stage: ${profile.stage || 'Not provided'}`,
      `- Budget: ${profile.budgetRange || 'Not provided'}`,
      `- Relocation window: ${profile.relocationWindow || 'Not provided'}`,
      `- Priorities: ${profile.priorities || 'Not provided'}`,
      `- Current location: ${profile.currentLocation || 'Not provided'}`,
    ].join('\n'));
  }

  if (ragContext) {
    parts.push(
      `\n--- FARO DATASET (researched city data — use as your source of truth for specific facts) ---\n${ragContext}\n--- END FARO DATASET ---`,
    );
  }

  return parts.join('\n');
}

// ── Instant replies (no AI needed) ───────────────────────────────────────────

export function getInstantReply(message: string): string | null {
  const normalized = message.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const compact = normalized.replace(/\s+/g, ' ');

  if (['hi', 'hello', 'hey', 'yo', 'good morning', 'good afternoon', 'good evening'].includes(compact)) {
    return 'Hi. Tell me your city, industry, budget, or grant question and I will help you compare options.';
  }
  if (['thanks', 'thank you', 'thx'].includes(compact)) {
    return 'You are welcome.';
  }

  const budgetMatch   = compact.match(/\b(?:budget|budget is|with)\s*(?:is\s*)?\$?(\d[\d,]*)\b/);
  const industryMatch = compact.match(/\bindustry\s*(?:is|:)?\s*([a-z][a-z\s-]{1,40})/);
  const locationMatch = compact.match(/\b(?:city|state|location)\s*(?:is|:)?\s*([a-z][a-z\s-]{1,40}?)(?:\s+budget|\s+industry|$)/);

  if (budgetMatch || industryMatch || locationMatch) {
    const budget   = budgetMatch?.[1]  ? `$${budgetMatch[1]}`        : 'your current budget';
    const industry = industryMatch?.[1]?.trim() || 'your industry';
    const location = locationMatch?.[1]?.trim() || 'that market';
    const isAlabama = /\balabama\b/.test(location);
    const placeNote = isAlabama
      ? 'Alabama is a state, so I would compare Birmingham, Huntsville, Montgomery, and Mobile before choosing one city.'
      : `For ${location}, I would first verify startup costs, local founder programs, and whether the city has customers or partners for ${industry}.`;

    return [
      placeNote,
      `With a ${budget} budget in ${industry}, keep the first move lean: validate demand, avoid long leases, and prioritize free support from an SBDC, chamber of commerce, or tech incubator.`,
      `Next steps: pick 2 candidate cities, list monthly costs for each, then look for local small-business grants or incubator programs before spending on setup.`,
    ].join('\n\n');
  }

  return null;
}

// ── Groq (free, fast cloud — primary when GROQ_API_KEY is set) ───────────────

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_TIMEOUT_MS = 15000;

let _groq: OpenAI | null = null;
function getGroq(): OpenAI {
  if (!_groq) {
    _groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY!,
    });
  }
  return _groq;
}

async function callGroq(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<string> {
  const groq = getGroq();
  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 600,
  });
  return (response.choices[0]?.message?.content ?? '').trim();
}

// ── Hermes (local Ollama — fallback when no Groq key) ────────────────────────

const HERMES_MODEL          = process.env.HERMES_MODEL          || 'hermes3:3b';
const HERMES_TIMEOUT_MS     = Number(process.env.HERMES_TIMEOUT_MS     || 45000);
const HERMES_MAX_TOKENS     = Number(process.env.HERMES_MAX_TOKENS     || 220);
const HERMES_CONTEXT_TOKENS = Number(process.env.HERMES_CONTEXT_TOKENS || 1024);
const HERMES_KEEP_ALIVE     = process.env.HERMES_KEEP_ALIVE     || '60m';
const HERMES_HISTORY_TURNS  = Number(process.env.HERMES_HISTORY_TURNS  || 4);
const HERMES_NUM_THREAD     = Number(process.env.HERMES_NUM_THREAD     || 8);

type HermesMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type OllamaChatResponse = { message?: { content?: string } };

function getOllamaChatUrl(): string {
  const base = process.env.HERMES_BASE_URL || 'http://localhost:11434/v1';
  return `${base.replace(/\/v1\/?$/, '').replace(/\/$/, '')}/api/chat`;
}

async function callHermes(messages: HermesMessage[], signal: AbortSignal): Promise<string> {
  const response = await fetch(getOllamaChatUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: HERMES_MODEL,
      messages,
      stream: false,
      keep_alive: HERMES_KEEP_ALIVE,
      options: {
        temperature: 0.2,
        top_p: 0.8,
        num_ctx: HERMES_CONTEXT_TOKENS,
        num_predict: HERMES_MAX_TOKENS,
        num_thread: HERMES_NUM_THREAD,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Hermes request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as OllamaChatResponse;
  return (payload.message?.content ?? '').trim();
}

export async function warmupHermes(): Promise<void> {
  try {
    await fetch(getOllamaChatUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HERMES_MODEL,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        keep_alive: HERMES_KEEP_ALIVE,
        options: { num_ctx: HERMES_CONTEXT_TOKENS, num_predict: 1, num_thread: HERMES_NUM_THREAD },
      }),
      signal: AbortSignal.timeout(180000),
    });
    console.log('[faro] Hermes warmed up.');
  } catch {
    console.warn('[faro] Hermes warmup skipped (Ollama not ready).');
  }
}

// ── Primary export ────────────────────────────────────────────────────────────
// Groq (free, ~1-3s) → Hermes (local, slower on CPU)

export async function callGemini(
  message: string,
  profile: UserProfile = {},
  history: ConversationTurn[] = [],
): Promise<string> {
  const instantReply = getInstantReply(message);
  if (instantReply) return instantReply;

  const ragContext = await buildRagContext(message, 1);
  const systemInstruction = buildSystemInstruction(profile, ragContext);

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    ...history.slice(-HERMES_HISTORY_TURNS).map((turn) => ({
      role: turn.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: turn.text,
    })),
    { role: 'user', content: message },
  ];

  // ── 1. Groq (free cloud, fast) ─────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('[faro] Calling Groq');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
      try {
        return await callGroq(openaiMessages);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      console.warn('[faro] Groq failed → falling back to Hermes:', String(err));
    }
  }

  // ── 2. Hermes (local Ollama) ───────────────────────────────────────────────
  console.log('[faro] Calling Hermes (Ollama)');

  const hermesMessages: HermesMessage[] = openaiMessages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content as string,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HERMES_TIMEOUT_MS);

  try {
    return await callHermes(hermesMessages, controller.signal);
  } catch (err) {
    console.error('[faro] Hermes failed:', String(err));
    throw new Error('The AI service is temporarily unavailable. Please try again in a moment.');
  } finally {
    clearTimeout(timer);
  }
}
