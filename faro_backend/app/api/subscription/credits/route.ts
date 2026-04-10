import { NextResponse } from 'next/server';
import { execute, query } from '@/lib/db';
import { requireAuth } from '@/lib/auth-session';
import { CREDIT_PACKS } from '../route';
import type { ResultSetHeader } from 'mysql2/promise';

export const runtime = 'nodejs';

type Pack = keyof typeof CREDIT_PACKS;

export async function POST(request: Request) {
  const authUser = await requireAuth(request);
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as { pack?: string };
    const pack = body.pack as Pack | undefined;
    if (!pack || !(pack in CREDIT_PACKS)) {
      return NextResponse.json({ error: 'Invalid pack. Choose small or large.' }, { status: 400 });
    }

    const { credits } = CREDIT_PACKS[pack];

    await execute<ResultSetHeader>(
      'UPDATE `User` SET chatCredits = chatCredits + ? WHERE id = ?',
      [credits, authUser.id],
    );

    const rows = await query<{ chatCredits: number | string }>(
      'SELECT chatCredits FROM `User` WHERE id = ?',
      [authUser.id],
    );
    const raw = rows[0]?.chatCredits;
    const chatCredits = typeof raw === 'string' ? Number(raw) : (raw ?? 0);

    return NextResponse.json({ chatCredits, creditsAdded: credits });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to buy credits', details: String(error) }, { status: 500 });
  }
}
