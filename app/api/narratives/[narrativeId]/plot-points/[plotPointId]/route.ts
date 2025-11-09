import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { narrativeId: string; plotPointId: string } }
) {
  try {
    const { plotPointId } = params;
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
    values.push(plotPointId);

    db.prepare(
      `UPDATE plot_points SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    const plotPoint = db.prepare('SELECT * FROM plot_points WHERE id = ?').get(plotPointId);

    return NextResponse.json({ plotPoint });
  } catch (error) {
    console.error('PUT /api/narratives/[id]/plot-points/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update plot point' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { narrativeId: string; plotPointId: string } }
) {
  try {
    const { plotPointId } = params;

    db.prepare('DELETE FROM plot_points WHERE id = ?').run(plotPointId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/narratives/[id]/plot-points/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete plot point' }, { status: 500 });
  }
}
