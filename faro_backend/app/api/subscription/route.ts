import { NextResponse } from 'next/server';
import { execute, query } from '@/lib/db';
import { requireAuth } from '@/lib/auth-session';
import type { ResultSetHeader } from 'mysql2/promise';

export const runtime = 'nodejs';

export const PLANS = {
  pro: { price: 17, credits: 50, label: 'Pro' },
  max: { price: 25, credits: 70, label: 'Max' },
} as const;

export const CREDIT_PACKS = {
  small: { credits: 10, price: 5, label: '10 credits' },
  large: { credits: 25, price: 10, label: '25 credits' },
} as const;

type Plan = keyof typeof PLANS;

type UserRow = {
  id: number;
  chatCredits: number | string;
  plan: string;
  planRenewsAt: Date | null;
};

const parseCredits = (v: number | string | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(request: Request) {
  const authUser = await requireAuth(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await query<UserRow>(
      'SELECT id, chatCredits, plan, planRenewsAt FROM `User` WHERE id = ?',
      [authUser.id],
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    return NextResponse.json({
      plan: user.plan || 'free',
      planRenewsAt: user.planRenewsAt,
      chatCredits: parseCredits(user.chatCredits),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subscription', details: String(error) }, { status: 500 });
  }
}

// Subscribe or switch plan — credits are SET to plan amount (not accumulated)
export async function POST(request: Request) {
  const authUser = await requireAuth(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as { plan?: string };
    const plan = body.plan as Plan | undefined;
    if (!plan || !(plan in PLANS)) {
      return NextResponse.json({ error: 'Invalid plan. Choose pro or max.' }, { status: 400 });
    }

    const { credits } = PLANS[plan];
    const planRenewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // SET chatCredits to plan amount — replace, never accumulate
    await execute<ResultSetHeader>(
      'UPDATE `User` SET plan = ?, planRenewsAt = ?, chatCredits = ? WHERE id = ?',
      [plan, planRenewsAt, credits, authUser.id],
    );

    const rows = await query<{ chatCredits: number | string }>(
      'SELECT chatCredits FROM `User` WHERE id = ?',
      [authUser.id],
    );
    const chatCredits = parseCredits(rows[0]?.chatCredits);

    return NextResponse.json({ plan, planRenewsAt, chatCredits, creditsGranted: credits });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update subscription', details: String(error) }, { status: 500 });
  }
}

// Cancel — revert to free, keep remaining credits
export async function DELETE(request: Request) {
  const authUser = await requireAuth(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await execute<ResultSetHeader>(
      "UPDATE `User` SET plan = 'free', planRenewsAt = NULL WHERE id = ?",
      [authUser.id],
    );
    const rows = await query<{ chatCredits: number | string }>(
      'SELECT chatCredits FROM `User` WHERE id = ?',
      [authUser.id],
    );
    return NextResponse.json({ plan: 'free', planRenewsAt: null, chatCredits: parseCredits(rows[0]?.chatCredits) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to cancel subscription', details: String(error) }, { status: 500 });
  }
}
