import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';

export const runtime = 'nodejs';

const guestQuestionLimit = 2;
const guestLimitWindowMs = 24 * 60 * 60 * 1000;
const guestLimitMessage =
  "You've used your 2 free questions. Log in or create an account to keep going.";

type GuestChatPayload = {
  message?: string;
  guestId?: string;
};

type GuestLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  var __guestChatIpLimit: Map<string, GuestLimitEntry> | undefined;
}

const guestLimitStore: Map<string, GuestLimitEntry> =
  globalThis.__guestChatIpLimit ?? new Map<string, GuestLimitEntry>();
globalThis.__guestChatIpLimit = guestLimitStore;

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const forwardedIp = forwardedFor.split(',')[0]?.trim();
  if (forwardedIp) return forwardedIp;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  return null;
};

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request) || 'unknown';
    const now = Date.now();
    const existing = guestLimitStore.get(ip);
    const entry =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + guestLimitWindowMs };

    if (entry.count >= guestQuestionLimit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return NextResponse.json(
        { error: guestLimitMessage },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        },
      );
    }

    const body = (await request.json()) as GuestChatPayload;
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const assistantText = await callGemini(message, {});

    guestLimitStore.set(ip, { ...entry, count: entry.count + 1 });

    return NextResponse.json({ reply: assistantText });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send guest chat message', details: String(error) },
      { status: 500 },
    );
  }
}
