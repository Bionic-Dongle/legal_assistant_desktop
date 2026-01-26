import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;
    const narrativeId = formData.get('narrativeId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!caseId) {
      return NextResponse.json({ error: 'No caseId provided' }, { status: 400 });
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate checksum for deduplication
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for duplicates
    const existing = db.prepare('SELECT * FROM timeline_documents WHERE checksum = ?').get(checksum) as any;
    if (existing) {
      return NextResponse.json({
        duplicate: true,
        document: existing,
        message: 'Document already uploaded'
      });
    }

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data', 'timeline-documents');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${sanitizedName}`;
    const filepath = path.join(dataDir, filename);

    // Save file
    fs.writeFileSync(filepath, buffer);

    // Extract text based on file type
    const fileType = path.extname(file.name).toLowerCase();
    let extractedText = '';

    try {
      if (fileType === '.txt') {
        extractedText = buffer.toString('utf-8');
      } else if (fileType === '.pdf' || fileType === '.docx' || fileType === '.doc') {
        // Basic text extraction (can be enhanced with pdf-parse or mammoth)
        extractedText = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
      } else {
        extractedText = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
      }
    } catch (error) {
      console.error('Text extraction error:', error);
      extractedText = '[Text extraction failed]';
    }

    // Save to database
    const docId = `doc-${Date.now()}`;
    db.prepare(`
      INSERT INTO timeline_documents
      (id, case_id, narrative_id, filename, filepath, checksum, file_type, extracted_text, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(docId, caseId, narrativeId || null, file.name, filepath, checksum, fileType, extractedText);

    return NextResponse.json({
      success: true,
      document: {
        id: docId,
        filename: file.name,
        fileType,
        checksum,
        extractedText: extractedText.substring(0, 1000) + (extractedText.length > 1000 ? '...' : ''),
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
