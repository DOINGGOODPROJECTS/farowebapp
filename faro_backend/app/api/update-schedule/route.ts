import { NextResponse } from 'next/server';
import { getUpdateSchedule, markCategoryUpdated } from '@/lib/sheetRag';

export const runtime = 'nodejs';

/** GET /api/update-schedule — return all category schedules from the sheet */
export async function GET() {
  try {
    const schedule = await getUpdateSchedule();
    return NextResponse.json({ schedule });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** POST /api/update-schedule — mark a column (or whole category) as just updated */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { category?: string; columnName?: string };
    if (!body.category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }
    await markCategoryUpdated(body.category, body.columnName);
    return NextResponse.json({
      ok: true,
      category: body.category,
      columnName: body.columnName ?? '(all)',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
