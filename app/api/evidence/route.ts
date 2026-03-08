
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { addDocuments } from '@/lib/chroma';
import { extractText } from '@/lib/extract';
import fs from 'fs';
import path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), 'data', 'evidence');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    const evidence = db.prepare(
      'SELECT * FROM evidence WHERE case_id = ? ORDER BY uploaded_at DESC'
    ).all(caseId);

    return NextResponse.json({ evidence });
  } catch (error) {
    console.error('GET /api/evidence error:', error);
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;
    const memoryType = formData.get('memoryType') as string;
    const extractedText = formData.get('extractedText') as string;
    const metadataJson = formData.get('metadata') as string;

    let metadata = null;
    if (metadataJson) {
      try {
        metadata = JSON.parse(metadataJson);
      } catch (e) {
        console.error('Failed to parse metadata JSON:', e);
      }
    }

    if (!file || !caseId || !memoryType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate checksum to prevent duplicate uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const crypto = await import("crypto");
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    const existing = db
      .prepare("SELECT id FROM evidence WHERE checksum = ?")
      .get(checksum) as { id?: string } | undefined;

    if (existing && existing.id) {
      return NextResponse.json(
        { message: "Duplicate upload detected", existingId: existing.id },
        { status: 200 }
      );
    }

    // Save file to disk
    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(EVIDENCE_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    // Extract text for embedding — proper PDF/DOCX/text extraction
    const { text: content } = await extractText(buffer, file.name, 50000);

    // Generate OpenAI embedding vector
    let embeddingVector = [];
    try {
      const allSettings = db
        .prepare("SELECT value FROM settings WHERE LOWER(key) = 'openai_api_key'")
        .get() as { value?: string } | undefined;
      const apiKey = allSettings?.value?.trim();
      if (apiKey) {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey });
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: content,
        });
        embeddingVector = embedding.data[0].embedding;
      } else {
        console.warn("⚠️ Missing API key: skipping vectorization");
      }
    } catch (error) {
      console.error("🧠 Embedding generation failed:", error);
    }

    // Save to vector store
    const collectionName = `${memoryType}_${caseId}`;
    const docId = `doc-${Date.now()}`;
    try {
      await addDocuments(
        collectionName,
        [content],
        [{ filename: file.name, type: memoryType, checksum }],
        [docId]
      );
    } catch (error) {
      console.error("Chroma vector store error:", error);
    }

    // Save metadata + checksum
    const evidenceId = `evidence-${Date.now()}`;

    // Build INSERT statement with metadata if available
    if (metadata) {
      db.prepare(`
        INSERT INTO evidence (
          id, case_id, filename, filepath, memory_type, checksum,
          extracted_text, document_type, actual_author, submitted_by_party,
          key_dates, key_entities, key_claims, document_tone,
          user_context_notes, defense_strategy, user_counter_narrative,
          strategic_summary,
          legal_areas, cause_of_action, relief_sought, legal_significance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        evidenceId, caseId, file.name, filepath, memoryType, checksum,
        extractedText || content,
        metadata.document_type || null,
        metadata.actual_author || null,
        metadata.submitted_by_party || null,
        metadata.key_dates ? JSON.stringify(metadata.key_dates) : null,
        metadata.key_entities ? JSON.stringify(metadata.key_entities) : null,
        metadata.key_claims ? JSON.stringify(metadata.key_claims) : null,
        metadata.document_tone || null,
        metadata.user_context_notes || null,
        metadata.defense_strategy || null,
        metadata.user_counter_narrative || null,
        metadata.strategic_summary || null,
        metadata.legal_areas ? JSON.stringify(metadata.legal_areas) : null,
        metadata.cause_of_action || null,
        metadata.relief_sought || null,
        metadata.legal_significance || null
      );
    } else {
      // No metadata - basic upload
      db.prepare(
        "INSERT INTO evidence (id, case_id, filename, filepath, memory_type, checksum, extracted_text) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(evidenceId, caseId, file.name, filepath, memoryType, checksum, extractedText || content);
    }

    return NextResponse.json({ id: evidenceId, filename: file.name });
  } catch (error) {
    console.error('POST /api/evidence error:', error);
    return NextResponse.json({ error: 'Failed to upload evidence' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const evidence: any = db.prepare('SELECT * FROM evidence WHERE id = ?').get(id);
    
    if (evidence?.filepath && fs.existsSync(evidence.filepath)) {
      fs.unlinkSync(evidence.filepath);
    }

    db.prepare('DELETE FROM evidence WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/evidence error:', error);
    return NextResponse.json({ error: 'Failed to delete evidence' }, { status: 500 });
  }
}
