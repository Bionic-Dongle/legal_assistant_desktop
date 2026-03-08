import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import db from '@/lib/db';
import { addDocuments } from '@/lib/chroma';

const QUEUE_DIR  = path.join(process.cwd(), 'data', 'import-queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'email-import-queue.json');
const ARCHIVE_FILE = path.join(QUEUE_DIR, 'email-import-queue-processed.json');

// GET — return count of pending items (and a short preview)
export async function GET() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) {
      return NextResponse.json({ pending: 0, items: [] });
    }
    const raw = fs.readFileSync(QUEUE_FILE, 'utf-8').trim();
    if (!raw || raw === '[]') {
      return NextResponse.json({ pending: 0, items: [] });
    }
    const items = JSON.parse(raw);
    return NextResponse.json({
      pending: items.length,
      items: items.slice(0, 5), // preview first 5
    });
  } catch {
    return NextResponse.json({ pending: 0, items: [] });
  }
}

// POST — ingest all items into LegalMind for a given caseId
export async function POST(req: NextRequest) {
  try {
    const { caseId } = await req.json();
    if (!caseId) {
      return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    }

    if (!fs.existsSync(QUEUE_FILE)) {
      return NextResponse.json({ processed: 0, skipped: 0, errors: [], message: 'No queue file found' });
    }

    const raw = fs.readFileSync(QUEUE_FILE, 'utf-8').trim();
    if (!raw || raw === '[]') {
      return NextResponse.json({ processed: 0, skipped: 0, errors: [], message: 'Queue is empty' });
    }

    const items: any[] = JSON.parse(raw);
    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];
    const doneItems: any[] = [];

    const evidenceDir = path.join(process.cwd(), 'data', 'evidence');
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

    for (const item of items) {
      try {
        // Dedup check — id is already a SHA-256 hash from Cowork
        const existing = db.prepare(
          'SELECT id FROM evidence WHERE id = ? OR checksum = ?'
        ).get(item.id, item.id);

        if (existing) {
          skipped++;
          doneItems.push(item);
          continue;
        }

        // Write extracted text as .eml file for document viewer support
        const filepath = path.join(evidenceDir, item.filename);
        fs.writeFileSync(filepath, item.extracted_text || '', 'utf-8');

        // Insert into SQLite evidence table (full metadata from Cowork triage)
        db.prepare(`
          INSERT INTO evidence (
            id, case_id, filename, filepath, memory_type, party, knowledge_domain,
            embedding_present, checksum, uploaded_at, extracted_text,
            document_type, actual_author, submitted_by_party,
            key_dates, key_entities, key_claims, document_tone,
            legal_areas, cause_of_action, relief_sought, legal_significance
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            0, ?, CURRENT_TIMESTAMP, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `).run(
          item.id,
          caseId,
          item.filename,
          filepath,
          item.memory_type  || 'neutral',
          item.party        || item.memory_type || 'neutral',
          'evidence',
          item.id, // checksum = same SHA-256 id
          item.extracted_text   || '',
          item.document_type    || 'email communication',
          item.actual_author    || null,
          item.submitted_by_party || null,
          JSON.stringify(item.key_dates    || []),
          JSON.stringify(item.key_entities || []),
          JSON.stringify(item.key_claims   || []),
          item.document_tone    || null,
          JSON.stringify(item.legal_areas  || []),
          item.cause_of_action  || null,
          item.relief_sought    || null,
          item.legal_significance || null
        );

        // Index in vector store for RAG retrieval
        // Generate OpenAI embedding so search quality matches directly uploaded files
        const collectionName = `${item.memory_type || 'neutral'}_${caseId}`;
        const textToEmbed = item.extracted_text || '';
        let embedding: number[] | null = null;

        if (textToEmbed) {
          try {
            const apiKeySetting = db
              .prepare("SELECT value FROM settings WHERE LOWER(key) = 'openai_api_key'")
              .get() as { value?: string } | undefined;
            const apiKey = apiKeySetting?.value?.trim() || process.env.OPENAI_API_KEY;

            if (apiKey) {
              const OpenAI = (await import('openai')).default;
              const openai = new OpenAI({ apiKey });
              const result = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: textToEmbed.substring(0, 8000), // stay within token limits
              });
              embedding = result.data[0].embedding;
            }
          } catch (embErr) {
            console.warn(`⚠️ Embedding failed for ${item.filename} — keyword search only:`, embErr);
          }
        }

        await addDocuments(
          collectionName,
          [textToEmbed],
          [{
            filename:      item.filename,
            memory_type:   item.memory_type,
            case_id:       caseId,
            document_type: item.document_type || 'email communication',
            actual_author: item.actual_author || '',
            ...(embedding ? { embedding } : {}),
          }],
          [item.id]
        );

        processed++;
        doneItems.push(item);
      } catch (err: any) {
        errors.push(`${item.filename || item.id}: ${err.message}`);
      }
    }

    // Remove processed/skipped items from queue
    const remaining = items.filter((item: any) => !doneItems.includes(item));

    // Append to processed archive
    let archive: any[] = [];
    if (fs.existsSync(ARCHIVE_FILE)) {
      try {
        archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8'));
      } catch { archive = []; }
    }
    const timestamp = new Date().toISOString();
    archive.push(...doneItems.map((item: any) => ({ ...item, processed_at: timestamp })));
    fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2), 'utf-8');

    // Write remaining items back (or empty array)
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(remaining, null, 2), 'utf-8');

    return NextResponse.json({ processed, skipped, errors });
  } catch (error: any) {
    console.error('[import-queue] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
