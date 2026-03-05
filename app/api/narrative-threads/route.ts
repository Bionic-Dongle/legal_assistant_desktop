import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('case_id');

    if (!caseId) {
      return NextResponse.json({ error: 'case_id required' }, { status: 400 });
    }

    const threads = db
      .prepare('SELECT * FROM narrative_threads WHERE case_id = ? ORDER BY sort_order ASC, created_at ASC')
      .all(caseId);

    return NextResponse.json({ threads });
  } catch (error) {
    console.error('GET /api/narrative-threads error:', error);
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { case_id, title, description, color, sort_order } = body;

    if (!case_id || !title) {
      return NextResponse.json({ error: 'case_id and title required' }, { status: 400 });
    }

    const id = `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    db.prepare(
      `INSERT INTO narrative_threads (id, case_id, title, description, color, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(
      id,
      case_id,
      title,
      description || null,
      color || '#6366f1',
      sort_order || 0
    );

    const thread = db.prepare('SELECT * FROM narrative_threads WHERE id = ?').get(id);

    return NextResponse.json({ thread }, { status: 201 });
  } catch (error) {
    console.error('POST /api/narrative-threads error:', error);
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
  }
}
