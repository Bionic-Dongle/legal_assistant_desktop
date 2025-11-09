import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { narrativeId: string; sectionId: string } }
) {
  try {
    const { sectionId } = params;
    const body = await request.json();
    const { title, content } = body;

    if (!title && !content) {
      return NextResponse.json({ error: 'Title or content required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }

    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(sectionId);

    db.prepare(
      `UPDATE narrative_sections SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    const section = db.prepare('SELECT * FROM narrative_sections WHERE id = ?').get(sectionId);

    return NextResponse.json({ section });
  } catch (error) {
    console.error('PUT /api/narratives/[id]/sections/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { narrativeId: string; sectionId: string } }
) {
  try {
    const { sectionId } = params;

    db.prepare('DELETE FROM narrative_sections WHERE id = ?').run(sectionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/narratives/[id]/sections/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 });
  }
}
