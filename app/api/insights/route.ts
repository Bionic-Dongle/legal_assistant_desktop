
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const category = searchParams.get('category');

    const insights = db.prepare(
      'SELECT * FROM saved_insights WHERE case_id = ? AND category = ? ORDER BY created_at DESC'
    ).all(caseId, category);

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('GET /api/insights error:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { caseId, content, category } = await request.json();
    const id = `insight-${Date.now()}`;

    // Direct insert using schema from lib/db.ts (which already defines created_at & completed)
    db.prepare(
      'INSERT INTO saved_insights (id, case_id, content, category) VALUES (?, ?, ?, ?)'
    ).run(id, caseId, content, category);

    return NextResponse.json({ id });
  } catch (error) {
    console.error('POST /api/insights error:', error);
    return NextResponse.json({ error: 'Failed to create insight' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, completed } = await request.json();

    db.prepare('UPDATE saved_insights SET completed = ? WHERE id = ?').run(completed, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/insights error:', error);
    return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    db.prepare('DELETE FROM saved_insights WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/insights error:', error);
    return NextResponse.json({ error: 'Failed to delete insight' }, { status: 500 });
  }
}
