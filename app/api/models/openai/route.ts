import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_key') as { value: string } | undefined;
    const apiKey = process.env.OPENAI_API_KEY || setting?.value?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'No OpenAI API key configured' }, { status: 401 });
    }

    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'OpenAI API error', status: res.status }, { status: res.status });
    }

    const data = await res.json();

    // Filter to chat completion models only — exclude embeddings, TTS, Whisper, DALL-E, fine-tunes
    const chatModels = (data.data as { id: string; owned_by: string }[])
      .filter(m => {
        const id = m.id;
        return (
          id.startsWith('gpt-4') ||
          id.startsWith('gpt-3.5-turbo') ||
          /^o[1-9]/.test(id)
        ) &&
          !id.includes('realtime') &&
          !id.includes('audio') &&
          !id.startsWith('ft:');
      })
      .sort((a, b) => b.id.localeCompare(a.id));

    return NextResponse.json({ data: chatModels });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch OpenAI models' }, { status: 500 });
  }
}
