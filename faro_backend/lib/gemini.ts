import OpenAI from 'openai';
import { buildRagContext } from './sheetRag';

const SYSTEM_INSTRUCTION = `You are Faro, an AI advisor for underrepresented entrepreneurs — Black founders, minority-owned businesses, women entrepreneurs, and first-generation business owners — across the United States and Africa (all 54 countries).

Your mission: help entrepreneurs make smart, data-backed decisions about where to start or grow their business. You cover:
- Recommending and comparing cities across the US and Africa for entrepreneurship
- Surfacing grants, funding programs, and eligibility requirements
- Explaining local business ecosystems, accelerators, and mentorship networks
- Evaluating relocation costs, living expenses, and setup costs
- Navigating policy incentives, tax credits, and minority/diaspora certifications

HOW TO USE THE FARO DATASET (when provided):
The dataset contains real, researched data for US and African cities — costs, grants, scores, and programs. Use it as your primary source for city-specific facts. Cite numbers, grant names, and org names directly. Never contradict the dataset.

WHEN NO DATASET IS PROVIDED:
Draw on your general knowledge. Be honest about uncertainty — say "based on general data" rather than inventing specific figures.

Response style:
- Concise and actionable — lead with the most important insight
- Back up recommendations with specific numbers, names, and programs from the dataset
- For city comparisons use a clear side-by-side structure (markdown table is fine)
- End every substantive answer with 1–2 concrete next steps the entrepreneur can take today

Output format: plain text or markdown only. No JSON or code blocks.`.trim();

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

// ── OpenAI (fallback cloud when OPENAI_API_KEY is set) ───────────────────────

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 20000;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _openai;
}

async function callOpenAI(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<string> {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
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
// Groq (free, ~1-3s) → OpenAI (cloud) → Hermes (local Ollama)

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
      console.warn('[faro] Groq failed → falling back to OpenAI:', String(err));
    }
  }

  // ── 2. OpenAI (cloud fallback when OPENAI_API_KEY is set) ─────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('[faro] Calling OpenAI');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
      try {
        return await callOpenAI(openaiMessages);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      console.warn('[faro] OpenAI failed → falling back to Hermes:', String(err));
    }
  }

  // ── 3. Hermes (local Ollama) ───────────────────────────────────────────────
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
