import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth-session';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authUser = await requireAuth(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await query<{
      id: number;
      email: string;
      name: string | null;
      chatCredits: number | string;
      plan: string;
      planRenewsAt: Date | null;
    }>(
      'SELECT id, email, name, chatCredits, plan, planRenewsAt FROM `User` WHERE id = ?',
      [authUser.id],
    );
    const user = users[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const chatCredits =
      typeof user.chatCredits === 'number'
        ? user.chatCredits
        : typeof user.chatCredits === 'string'
          ? Number(user.chatCredits)
          : 0;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        chatCredits: Number.isFinite(chatCredits) ? chatCredits : 0,
        plan: user.plan || 'free',
        planRenewsAt: user.planRenewsAt,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user', details: String(error) }, { status: 500 });
  }
}
