import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '@/lib/db';
import { extractText } from '@/lib/extract';
import { getDataDir } from '@/lib/paths';
import { triageDocument } from '@/lib/triage';

const QUEUE_DIR  = path.join(getDataDir(), 'import-queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'email-import-queue.json');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']);
const SKIP_EXTS  = new Set(['.db', '.json', '.exe', '.dll', '.zip', '.rar', '.7z', '.lnk', '.tmp']);
const BATCH_SIZE = 30; // files per run — run again to continue

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!SKIP_EXTS.has(ext) && !entry.name.startsWith('.') && !entry.name.startsWith('~$')) {
          results.push(fullPath);
        }
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const { plaintiffFolder, defenceFolder, caseId } = await req.json();
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s = Object.fromEntries(settings.map(r => [r.key, r.value]));
    const apiKey = s['openai_api_key']?.trim() || process.env.OPENAI_API_KEY || '';
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });

    const caseContext = s['main_chat_system_prompt'] || s['system_prompt_main'] || s['custom_system_prompt'] || '';

    // Collect all files from both folders
    type FilePair = { filepath: string; defaultType: 'plaintiff' | 'opposition' };
    const filePairs: FilePair[] = [];
    if (plaintiffFolder?.trim()) walkDir(plaintiffFolder.trim()).forEach(f => filePairs.push({ filepath: f, defaultType: 'plaintiff' }));
    if (defenceFolder?.trim())   walkDir(defenceFolder.trim()).forEach(f =>   filePairs.push({ filepath: f, defaultType: 'opposition' }));

    if (filePairs.length === 0) {
      return NextResponse.json({ queued: 0, skipped: 0, errors: [], message: 'No files found in the specified folders' });
    }

    // Load existing queue for dedup
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
    let existingQueue: any[] = [];
    if (fs.existsSync(QUEUE_FILE)) {
      try { existingQueue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8').trim() || '[]'); } catch { existingQueue = []; }
    }
    const existingIds = new Set(existingQueue.map((i: any) => i.id));

    let queued = 0, skipped = 0;
    const errors: string[] = [];
    const newItems: any[] = [];

    // Only process first BATCH_SIZE files — user runs again for more
    const toProcess = filePairs.slice(0, BATCH_SIZE);

    for (const { filepath, defaultType } of toProcess) {
      try {
        const filename = path.basename(filepath);
        const stat    = fs.statSync(filepath);
        const checksumId = crypto.createHash('sha256').update(filename + stat.size.toString()).digest('hex');

        if (existingIds.has(checksumId)) { skipped++; continue; }
        const already = db.prepare('SELECT id FROM evidence WHERE checksum = ?').get(checksumId);
        if (already) { skipped++; continue; }

        const ext = path.extname(filename).toLowerCase();
        let extractedText = '';
        let isImage = false;
        let imageBase64: string | undefined;
        let imageMimeType: string | undefined;

        if (IMAGE_EXTS.has(ext)) {
          isImage = true;
          const buffer = fs.readFileSync(filepath);
          imageBase64 = buffer.toString('base64');
          const mimeMap: Record<string, string> = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif',  '.webp': 'image/webp', '.bmp': 'image/bmp', '.tiff': 'image/tiff',
          };
          imageMimeType = mimeMap[ext] || 'image/jpeg';
        } else {
          const buffer = fs.readFileSync(filepath);
          const result = await extractText(buffer, filename);
          extractedText = result.text;
          if (!extractedText.trim()) { skipped++; continue; }
        }

        const triage = await triageDocument(apiKey, filename, extractedText, caseContext, isImage, imageBase64, imageMimeType);
        if (!triage.is_relevant) { skipped++; continue; }

        const dateSlug   = new Date().toISOString().split('T')[0];
        const nameSlug   = filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '-').substring(0, 40).toLowerCase();
        const queueFilename = `${dateSlug}-${nameSlug}${ext}`;

        const item = {
          id:                checksumId,
          filename:          queueFilename,
          original_filepath: filepath,
          memory_type:       triage.memory_type  || defaultType,
          party:             triage.party         || defaultType,
          document_type:     triage.document_type || 'document',
          actual_author:     triage.actual_author || null,
          submitted_by_party: triage.party        || defaultType,
          extracted_text:    extractedText,
          key_dates:         triage.key_dates     || [],
          key_entities:      triage.key_entities  || [],
          key_claims:        triage.key_claims     || [],
          document_tone:     triage.document_tone  || 'neutral',
          legal_areas:       triage.legal_areas    || [],
          cause_of_action:   triage.cause_of_action || null,
          legal_significance: triage.legal_significance || null,
          source_account:    'local_folder',
          scanned_at:        new Date().toISOString(),
        };

        newItems.push(item);
        existingIds.add(checksumId);
        queued++;
      } catch (err: any) {
        errors.push(`${path.basename(filepath)}: ${err.message}`);
      }
    }

    if (newItems.length > 0) {
      existingQueue.push(...newItems);
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(existingQueue, null, 2), 'utf-8');
    }

    const remaining = filePairs.length - toProcess.length;
    const msg = remaining > 0
      ? `${queued} queued, ${skipped} skipped. ${remaining} more files not yet processed — run Scan again to continue.`
      : `${queued} documents added to the import queue, ${skipped} already seen.`;

    return NextResponse.json({ queued, skipped, errors, remaining, message: msg });
  } catch (error: any) {
    console.error('[scan-folders]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
