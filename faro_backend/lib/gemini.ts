import OpenAI from 'openai';
import { buildRagContext } from './sheetRag';

const SYSTEM_INSTRUCTION = `
You are Faro, an AI advisor built specifically for underrepresented entrepreneurs — Black founders, minority-owned businesses, women entrepreneurs, and first-generation business owners across the United States.

Your mission: help entrepreneurs make smart, data-backed decisions about where to start or grow their business. You cover:
- Recommending and comparing US cities for entrepreneurship
- Surfacing grants, funding programs, and eligibility requirements
- Explaining local business ecosystems, accelerators, and mentorship networks
- Evaluating relocation costs, living expenses, and setup costs
- Navigating policy incentives, tax credits, and minority certifications

HOW TO USE THE FARO DATASET (when provided below):
The dataset contains real, researched data for US cities — costs, grants, scores, and programs curated specifically for underrepresented founders. Use it as your primary source for city-specific facts:
- When the dataset has a grant name, funder, or deadline — cite it directly.
- When it has cost indices or scores — use those numbers to back your recommendation.
- When it has real organization names (chambers, accelerators, SBDC chapters) — reference them by name.
- The dataset GUIDES your answer but does not limit it. You may supplement with your general knowledge about cities, industries, and entrepreneurship — especially for context, strategy, and explanation.
- Never contradict the dataset. If the dataset says cost index is 62, do not call the city expensive.

WHEN NO DATASET IS PROVIDED or a topic isn't covered:
Draw on your general knowledge. Be honest about uncertainty — say "based on general data" rather than inventing specific figures.

Response style:
- Concise and actionable — lead with the most important insight
- Back up recommendations with specific numbers, names, and programs from the dataset
- For city comparisons use a clear side-by-side structure (markdown table is fine)
- End every substantive answer with 1–2 concrete next steps the entrepreneur can take today
- Ask one clarifying question if you genuinely need more context (industry, budget, city)

Output format rules:
- Return ONLY plain text or markdown.
- Do NOT return JSON or code blocks.
- You may use markdown tables when comparing multiple cities.
`.trim();

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
    profile.industry ||
    profile.stage ||
    profile.budgetRange ||
    profile.relocationWindow ||
    profile.priorities ||
    profile.currentLocation;

  if (hasProfile) {
    const profileLines = [
      `- Industry: ${profile.industry || 'Not provided'}`,
      `- Stage: ${profile.stage || 'Not provided'}`,
      `- Budget: ${profile.budgetRange || 'Not provided'}`,
      `- Relocation window: ${profile.relocationWindow || 'Not provided'}`,
      `- Priorities: ${profile.priorities || 'Not provided'}`,
      `- Current location: ${profile.currentLocation || 'Not provided'}`,
    ];
    parts.push(`\nUser profile:\n${profileLines.join('\n')}`);
  }

  if (ragContext) {
    parts.push(
      `\n--- FARO DATASET (researched city data — use as your source of truth for specific facts) ---\n${ragContext}\n--- END FARO DATASET ---`,
    );
  }

  return parts.join('\n');
}

// ── Timeout helper ────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

// ── Hermes client (Ollama — OpenAI-compatible) ────────────────────────────────

let _hermes: OpenAI | null = null;
function getHermes(): OpenAI {
  if (!_hermes) {
    _hermes = new OpenAI({
      baseURL: process.env.HERMES_BASE_URL || 'http://localhost:11434/v1',
      apiKey: 'ollama',
    });
  }
  return _hermes;
}

// ── OpenAI client ─────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OPENAI_API_KEY is not configured.');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HERMES_MODEL          = process.env.HERMES_MODEL || 'hermes3:3b';
const OPENAI_FALLBACK_MODEL = 'gpt-4.1-nano';
const HERMES_TIMEOUT_MS     = 60000; // 60 s — RAG context capped at 3 profiles for Hermes
const OPENAI_TIMEOUT_MS     = 20000; // 20 s
const CLAUDE_TIMEOUT_MS     = 25000; // 25 s

// ── Provider: Hermes (local Ollama) ──────────────────────────────────────────

async function callHermes(
  message: string,
  profile: UserProfile,
  history: ConversationTurn[],
  ragContext: string,
): Promise<string> {
  const hermes = getHermes();
  const systemInstruction = buildSystemInstruction(profile, ragContext);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    ...history.map((turn) => ({
      role: turn.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: turn.text,
    })),
    { role: 'user', content: message },
  ];

  const response = await hermes.chat.completions.create({
    model: HERMES_MODEL,
    messages,
    temperature: 0.4,
  });

  return (response.choices[0]?.message?.content ?? '').trim();
}

// ── Provider: GPT-4.1-nano ────────────────────────────────────────────────────

async function callOpenAIFallback(
  message: string,
  profile: UserProfile,
  history: ConversationTurn[],
  ragContext: string,
): Promise<string> {
  const openai = getOpenAI();
  const systemInstruction = buildSystemInstruction(profile, ragContext);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    ...history.map((turn) => ({
      role: turn.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: turn.text,
    })),
    { role: 'user', content: message },
  ];

  const response = await openai.chat.completions.create({
    model: OPENAI_FALLBACK_MODEL,
    messages,
    temperature: 0.4,
  });

  return (response.choices[0]?.message?.content ?? '').trim();
}

// ── Provider: Claude Agent ────────────────────────────────────────────────────

async function callClaudeAgent(
  message: string,
  profile: UserProfile,
  history: ConversationTurn[],
  ragContext: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const agentId = process.env.CLAUDE_AGENT_ID;

  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  if (!agentId) {
    throw new Error('CLAUDE_AGENT_ID is not configured.');
  }

  const systemContext = buildSystemInstruction(profile, ragContext);

  const historyText = history
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`)
    .join('\n');

  const fullPrompt = [
    systemContext,
    historyText ? `\nConversation so far:\n${historyText}` : '',
    `\nUser: ${message}`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch('https://api.anthropic.com/v1/sessions', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'managed-agents-2026-04-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: agentId,
      input: fullPrompt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude agent error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  const reply =
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    '';

  if (!reply) throw new Error('Empty Claude agent response.');

  return reply.trim();
}

// ── Primary export ────────────────────────────────────────────────────────────
// Provider order: Hermes (local Ollama) → GPT-4.1-nano → Claude Agent

export async function callGemini(
  message: string,
  profile: UserProfile = {},
  history: ConversationTurn[] = [],
): Promise<string> {
  // Fetch RAG context — use compact context for Hermes (small model)
  const ragContext      = await buildRagContext(message);
  const ragContextSmall = await buildRagContext(message, 3);

  // ── 1. Hermes (local Ollama) ───────────────────────────────────────────────
  try {
    console.log('[faro] Using Hermes (Ollama)');
    return await withTimeout(
      callHermes(message, profile, history, ragContextSmall),
      HERMES_TIMEOUT_MS,
    );
  } catch (hermesError) {
    console.warn('[faro] Hermes failed → trying GPT-4.1-nano', String(hermesError));
  }

  // ── 2. GPT-4.1-nano ───────────────────────────────────────────────────────
  try {
    return await withTimeout(
      callOpenAIFallback(message, profile, history, ragContext),
      OPENAI_TIMEOUT_MS,
    );
  } catch (openaiError) {
    console.warn('[faro] GPT-4.1-nano failed → trying Claude agent', String(openaiError));
  }

  // ── 3. Claude Agent ───────────────────────────────────────────────────────
  try {
    return await withTimeout(
      callClaudeAgent(message, profile, history, ragContext),
      CLAUDE_TIMEOUT_MS,
    );
  } catch (claudeError) {
    console.error('[faro] All AI providers failed', String(claudeError));
    throw new Error('The AI service is temporarily unavailable. Please try again in a moment.');
  }
}
