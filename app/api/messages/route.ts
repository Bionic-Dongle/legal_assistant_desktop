
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const messages = db.prepare(
      'SELECT * FROM messages WHERE case_id = ? ORDER BY timestamp ASC'
    ).all(caseId);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('GET /api/messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { caseId } = await request.json();

    if (!caseId) {
      return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    }

    db.prepare('DELETE FROM messages WHERE case_id = ?').run(caseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/messages error:', error);
    return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
  }
}
