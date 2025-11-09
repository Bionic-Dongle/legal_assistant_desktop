import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const case_id = searchParams.get('case_id');

    if (!case_id) {
      return NextResponse.json({ error: 'case_id required' }, { status: 400 });
    }

    const narratives = db
      .prepare('SELECT * FROM narratives WHERE case_id = ? ORDER BY created_at DESC')
      .all(case_id);

    return NextResponse.json({ narratives });
  } catch (error) {
    console.error('GET /api/narratives error:', error);
    return NextResponse.json({ error: 'Failed to fetch narratives' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { case_id, title, narrative_type, plot_point_id } = body;

    if (!case_id || !title || !narrative_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['main', 'sub'].includes(narrative_type)) {
      return NextResponse.json({ error: 'Invalid narrative_type' }, { status: 400 });
    }

    // Sub-narratives must have a plot_point_id
    if (narrative_type === 'sub' && !plot_point_id) {
      return NextResponse.json({ error: 'Sub-narratives must be attached to a plot point' }, { status: 400 });
    }

    const id = `narr-${Date.now()}`;
    db.prepare(
      `INSERT INTO narratives (id, case_id, title, narrative_type, plot_point_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, case_id, title, narrative_type, plot_point_id || null);

    const narrative = db.prepare('SELECT * FROM narratives WHERE id = ?').get(id);

    return NextResponse.json({ narrative }, { status: 201 });
  } catch (error) {
    console.error('POST /api/narratives error:', error);
    return NextResponse.json({ error: 'Failed to create narrative' }, { status: 500 });
  }
}
