import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const caseId = searchParams.get('caseId');

    if (!filename || !caseId) {
      return NextResponse.json({ error: 'Missing filename or caseId' }, { status: 400 });
    }

    // Try exact match first
    let evidence = db.prepare(`
      SELECT id, filename, extracted_text, document_type, actual_author,
             submitted_by_party, uploaded_at, memory_type
      FROM evidence
      WHERE case_id = ? AND filename = ?
      LIMIT 1
    `).get(caseId, filename) as any;

    // If no exact match, try fuzzy matching (case-insensitive, ignore extra spaces)
    if (!evidence) {
      const allEvidence = db.prepare(`
        SELECT id, filename, extracted_text, document_type, actual_author,
               submitted_by_party, uploaded_at, memory_type
        FROM evidence
        WHERE case_id = ?
      `).all(caseId) as any[];

      // Normalize filename for comparison (lowercase, remove ALL spaces)
      const normalizeFilename = (name: string) =>
        name.toLowerCase().replace(/\s+/g, '').trim();

      // Score each potential match - higher score = better match
      const scored = allEvidence.map(e => {
        const normalizedDb = normalizeFilename(e.filename);
        const normalizedSearch = normalizeFilename(filename);
        let score = 0;

        // Exact match after normalization = best
        if (normalizedDb === normalizedSearch) score = 100;

        // Base name exact match (without extension)
        else {
          const getBaseName = (f: string) => f.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '');
          if (getBaseName(e.filename) === getBaseName(filename)) score = 90;

          // One contains the other - prefer shorter filename (more specific match)
          else if (normalizedDb.includes(normalizedSearch)) {
            score = 50 - (normalizedDb.length - normalizedSearch.length);
          }
          else if (normalizedSearch.includes(normalizedDb)) {
            score = 40;
          }
        }

        return { evidence: e, score };
      });

      // Get the best match with score > 0
      const bestMatch = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];
      evidence = bestMatch?.evidence;
    }

    if (!evidence) {
      console.log(`[by-filename] Document not found: "${filename}" in case ${caseId}`);
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    console.log(`[by-filename] Found document: "${evidence.filename}" (searched for: "${filename}")`);

    return NextResponse.json({ evidence });
  } catch (error) {
    console.error('GET /api/evidence/by-filename error:', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}
