import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { narrativeId: string } }
) {
  try {
    const { narrativeId } = params;

    const sections = db
      .prepare('SELECT * FROM narrative_sections WHERE narrative_id = ? ORDER BY sort_order ASC, created_at ASC')
      .all(narrativeId);

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('GET /api/narratives/[id]/sections error:', error);
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { narrativeId: string } }
) {
  try {
    const { narrativeId } = params;
    const body = await request.json();
    const { title, content, sort_order } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const id = `sect-${Date.now()}`;
    db.prepare(
      `INSERT INTO narrative_sections (id, narrative_id, title, content, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, narrativeId, title, content || '', sort_order || 0);

    const section = db.prepare('SELECT * FROM narrative_sections WHERE id = ?').get(id);

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error('POST /api/narratives/[id]/sections error:', error);
    return NextResponse.json({ error: 'Failed to create section' }, { status: 500 });
  }
}
