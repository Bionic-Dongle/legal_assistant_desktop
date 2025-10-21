
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { addDocuments } from '@/lib/chroma';
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

    // Extract text for embedding
    const content = buffer.toString("utf-8").substring(0, 10000);

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
    db.prepare(
      "INSERT INTO evidence (id, case_id, filename, filepath, memory_type, checksum) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(evidenceId, caseId, file.name, filepath, memoryType, checksum);

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
