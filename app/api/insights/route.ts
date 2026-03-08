
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { addDocuments, removeDocuments } from '@/lib/chroma';

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

    // Vectorize insights and arguments (not todos — todos are task lists, not analytical content)
    if (category === 'insight' || category === 'argument') {
      try {
        const collectionName = `${category}s_${caseId}`; // insights_{caseId} or arguments_{caseId}

        let embedding: number[] | null = null;
        const apiKeySetting = db
          .prepare("SELECT value FROM settings WHERE LOWER(key) = 'openai_api_key'")
          .get() as { value?: string } | undefined;
        const apiKey = apiKeySetting?.value?.trim() || process.env.OPENAI_API_KEY;

        if (apiKey) {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey });
          const result = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: content,
          });
          embedding = result.data[0].embedding;
        }

        await addDocuments(
          collectionName,
          [content],
          [{ category, caseId, id, ...(embedding ? { embedding } : {}) }],
          [id]
        );
      } catch (err) {
        console.warn('⚠️ Failed to vectorize insight — saved to SQLite only:', err);
      }
    }

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

    // Look up before deleting so we know which vector collection to clean up
    const item = db
      .prepare('SELECT case_id, category FROM saved_insights WHERE id = ?')
      .get(id) as { case_id: string; category: string } | undefined;

    db.prepare('DELETE FROM saved_insights WHERE id = ?').run(id);

    if (item && (item.category === 'insight' || item.category === 'argument')) {
      try {
        const collectionName = `${item.category}s_${item.case_id}`;
        await removeDocuments(collectionName, [id!]);
      } catch (err) {
        console.warn('⚠️ Failed to remove from vector store:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/insights error:', error);
    return NextResponse.json({ error: 'Failed to delete insight' }, { status: 500 });
  }
}
