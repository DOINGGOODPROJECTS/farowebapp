import { NextResponse } from 'next/server';
import { execute, query } from '@/lib/db';
import { requireAuth } from '@/lib/auth-session';
import { callGemini, type ConversationTurn, type UserProfile } from '@/lib/gemini';
import type { ResultSetHeader } from 'mysql2/promise';

export const runtime = 'nodejs';

type ChatPayload = {
  sessionId?: number;
  message?: string;
};

const chatReplyCreditCost = 1;
const outOfCreditsMessage =
  'You have used all your chat credits. Upgrade your plan to continue chatting.';

const parseCredits = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getTitleFromMessage = (message: string) =>
  message.replace(/\s+/g, ' ').trim().slice(0, 60);

export async function POST(request: Request) {
  const authUser = await requireAuth(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ChatPayload;
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const creditRows = await query<{ chatCredits: number | string }>(
      'SELECT chatCredits FROM `User` WHERE id = ?',
      [authUser.id],
    );
    const creditsBefore = parseCredits(creditRows[0]?.chatCredits);
    if (creditsBefore <= 0) {
      return NextResponse.json(
        {
          error: outOfCreditsMessage,
          code: 'UPGRADE_REQUIRED',
          creditsRemaining: 0,
        },
        { status: 402 },
      );
    }

    let sessionId = body.sessionId;
    if (sessionId) {
      const sessions = await query<{ id: number }>(
        'SELECT id FROM `ChatSession` WHERE id = ? AND userId = ?',
        [sessionId, authUser.id],
      );
      if (sessions.length === 0) {
        return NextResponse.json({ error: 'Invalid session.' }, { status: 404 });
      }
    } else {
      const title = getTitleFromMessage(message);
      const sessionResult = await execute<ResultSetHeader>(
        'INSERT INTO `ChatSession` (userId, title) VALUES (?, ?)',
        [authUser.id, title],
      );
      sessionId = sessionResult.insertId;
    }

    await execute<ResultSetHeader>(
      'INSERT INTO `ChatMessage` (sessionId, role, content) VALUES (?, ?, ?)',
      [sessionId, 'USER', message],
    );

    // Fetch user profile to personalise the response
    const profileRows = await query<{
      industry: string | null;
      stage: string | null;
      budgetRange: string | null;
      relocationWindow: string | null;
      priorities: string | null;
      currentLocation: string | null;
    }>(
      'SELECT industry, stage, budgetRange, relocationWindow, priorities, currentLocation FROM `UserProfile` WHERE userId = ?',
      [authUser.id],
    );
    const profileRow = profileRows[0];
    const profile: UserProfile = profileRow
      ? {
          industry: profileRow.industry,
          stage: profileRow.stage,
          budgetRange: profileRow.budgetRange,
          relocationWindow: profileRow.relocationWindow,
          priorities:
            typeof profileRow.priorities === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(profileRow.priorities) as unknown;
                    return Array.isArray(parsed) ? (parsed as string[]).join(', ') : String(parsed);
                  } catch {
                    return profileRow.priorities;
                  }
                })()
              : null,
          currentLocation: profileRow.currentLocation,
        }
      : {};

    // Fetch the last 10 prior messages in this session as conversation history
    const historyRows = await query<{ role: 'USER' | 'ASSISTANT'; content: string }>(
      `SELECT role, content FROM \`ChatMessage\`
       WHERE sessionId = ? AND role IN ('USER', 'ASSISTANT')
       ORDER BY createdAt DESC LIMIT 10`,
      [sessionId],
    );
    const history: ConversationTurn[] = historyRows
      .reverse()
      // drop the last entry — it's the user message we just inserted
      .slice(0, -1)
      .map((row) => ({
        role: row.role === 'USER' ? 'user' : 'model',
        text: row.content,
      }));

    const assistantText = await callGemini(message, profile, history);

    await execute<ResultSetHeader>(
      'INSERT INTO `ChatMessage` (sessionId, role, content) VALUES (?, ?, ?)',
      [sessionId, 'ASSISTANT', assistantText],
    );

    await execute<ResultSetHeader>(
      'UPDATE `ChatSession` SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [sessionId],
    );

    await execute<ResultSetHeader>(
      'UPDATE `User` SET chatCredits = GREATEST(chatCredits - ?, 0) WHERE id = ?',
      [chatReplyCreditCost, authUser.id],
    );
    const updatedCreditRows = await query<{ chatCredits: number | string }>(
      'SELECT chatCredits FROM `User` WHERE id = ?',
      [authUser.id],
    );
    const creditsRemaining = Math.max(0, parseCredits(updatedCreditRows[0]?.chatCredits));

    return NextResponse.json({
      sessionId,
      reply: assistantText,
      creditsRemaining,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send chat message', details: String(error) },
      { status: 500 },
    );
  }
}
