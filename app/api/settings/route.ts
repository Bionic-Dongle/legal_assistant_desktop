
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const settings: any[] = db.prepare('SELECT * FROM settings').all();
    const settingsObj: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsObj[s.key] = s.value;
    });
    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      db.prepare(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
      ).run(key, value);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
