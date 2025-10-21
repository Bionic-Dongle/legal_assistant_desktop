
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
