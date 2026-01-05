import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { narrativeId: string } }
) {
  try {
    const { narrativeId } = params;

    const plotPoints = db
      .prepare('SELECT * FROM plot_points WHERE narrative_id = ? ORDER BY sort_order ASC, created_at ASC')
      .all(narrativeId);

    return NextResponse.json({ plotPoints });
  } catch (error) {
    console.error('GET /api/narratives/[id]/plot-points error:', error);
    return NextResponse.json({ error: 'Failed to fetch plot points' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { narrativeId: string } }
) {
  try {
    const { narrativeId } = params;
    const body = await request.json();
    const { title, content, sort_order, event_date, evidence_date, thread_id, attachments } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const id = `plot-${Date.now()}`;
    db.prepare(
      `INSERT INTO plot_points (id, narrative_id, thread_id, title, content, sort_order, event_date, evidence_date, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, narrativeId, thread_id || null, title, content || '', sort_order || 0, event_date || null, evidence_date || null, attachments || null);

    const plotPoint = db.prepare('SELECT * FROM plot_points WHERE id = ?').get(id);

    return NextResponse.json({ plotPoint }, { status: 201 });
  } catch (error) {
    console.error('POST /api/narratives/[id]/plot-points error:', error);
    return NextResponse.json({ error: 'Failed to create plot point' }, { status: 500 });
  }
}
