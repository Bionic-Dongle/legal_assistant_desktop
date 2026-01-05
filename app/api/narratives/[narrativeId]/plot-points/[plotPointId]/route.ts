import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { narrativeId: string; plotPointId: string } }
) {
  try {
    const { plotPointId } = params;
    const body = await request.json();
    const { title, content, thread_id, event_date, evidence_date, sort_order, attachments } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }

    if (thread_id !== undefined) {
      updates.push('thread_id = ?');
      values.push(thread_id);
    }

    if (event_date !== undefined) {
      updates.push('event_date = ?');
      values.push(event_date);
    }

    if (evidence_date !== undefined) {
      updates.push('evidence_date = ?');
      values.push(evidence_date);
    }

    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (attachments !== undefined) {
      updates.push('attachments = ?');
      values.push(attachments);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
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
