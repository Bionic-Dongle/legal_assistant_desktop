import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET — return un-plotted evidence with suggested plot point data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const case_id = searchParams.get('case_id');

  if (!case_id) {
    return NextResponse.json({ error: 'case_id required' }, { status: 400 });
  }

  const evidence = db.prepare(`
    SELECT id, filename, memory_type, party, document_type, actual_author,
           key_dates, key_claims, legal_significance, extracted_text,
           document_tone, uploaded_at
    FROM evidence
    WHERE case_id = ?
      AND (auto_plotted IS NULL OR auto_plotted = 0)
    ORDER BY filename ASC
  `).all(case_id) as any[];

  const suggestions = evidence.map((ev) => {
    const eventDate = extractDate(ev.filename, ev.key_dates);

    const authorPart = ev.actual_author
      ? ev.actual_author.split(/\s+/).slice(0, 2).join(' ')
      : null;
    const typePart = ev.document_type ? formatDocType(ev.document_type) : 'Document';
    const suggestedTitle = authorPart
      ? `${authorPart} — ${typePart}`
      : ev.filename.replace(/\.[^.]+$/, '').replace(/-/g, ' ');

    const content = buildContent(ev);

    return {
      evidenceId: ev.id,
      filename: ev.filename,
      memory_type: ev.memory_type,
      suggestedTitle,
      date: eventDate,
      undated: !eventDate,
      content,
      document_type: ev.document_type,
      legal_significance: ev.legal_significance,
    };
  });

  return NextResponse.json({ suggestions });
}

// POST — mark evidence items as auto_plotted = 1 after user creates their plot points
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evidenceIds } = body as { evidenceIds: string[] };

    if (!evidenceIds || !Array.isArray(evidenceIds)) {
      return NextResponse.json({ error: 'evidenceIds array required' }, { status: 400 });
    }

    const stmt = db.prepare('UPDATE evidence SET auto_plotted = 1 WHERE id = ?');
    for (const id of evidenceIds) {
      stmt.run(id);
    }

    return NextResponse.json({ marked: evidenceIds.length });
  } catch (error: any) {
    console.error('[auto-plot] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function extractDate(filename: string, keyDatesJson: string | null): string | null {
  // Cowork filenames start with YYYY-MM-DD
  const fromFilename = filename?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  if (fromFilename) return fromFilename;

  // Fall back to first ISO date in key_dates JSON array
  if (keyDatesJson) {
    try {
      const dates: string[] = JSON.parse(keyDatesJson);
      if (Array.isArray(dates) && dates.length > 0) {
        const match = dates[0].match(/(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
      }
    } catch {}
  }

  return null;
}

function formatDocType(dt: string): string {
  return dt
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildContent(ev: any): string {
  const parts: string[] = [];

  if (ev.legal_significance) {
    parts.push(`<p><strong>Significance:</strong> ${ev.legal_significance}</p>`);
  }

  if (ev.key_claims) {
    try {
      const claims: string[] = JSON.parse(ev.key_claims);
      if (Array.isArray(claims) && claims.length > 0) {
        const items = claims.map((c) => `<li>${c}</li>`).join('');
        parts.push(`<ul>${items}</ul>`);
      }
    } catch {}
  }

  // Text message screenshots: include the verbatim transcription
  if (ev.document_type === 'text message screenshot' && ev.extracted_text) {
    const preview = ev.extracted_text.substring(0, 3000);
    parts.push(`<pre style="font-size:0.85em;white-space:pre-wrap;">${preview}</pre>`);
  }

  return parts.length > 0
    ? parts.join('\n')
    : '<p>No structured content available.</p>';
}
