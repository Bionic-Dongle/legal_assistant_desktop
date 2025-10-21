
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const cases = db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();
    return NextResponse.json({ cases });
  } catch (error) {
    console.error('GET /api/cases error:', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, description } = await request.json();
    const id = `case-${Date.now()}`;
    
    db.prepare('INSERT INTO cases (id, title, description) VALUES (?, ?, ?)').run(
      id,
      title,
      description
    );

    return NextResponse.json({ id, title, description });
  } catch (error) {
    console.error('POST /api/cases error:', error);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
