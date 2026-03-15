import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '@/lib/db';
import { getDataDir } from '@/lib/paths';
import { triageDocument } from '@/lib/triage';

const QUEUE_DIR  = path.join(getDataDir(), 'import-queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'email-import-queue.json');

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Gmail token — please reconnect Gmail in Settings');
  const data = await res.json();
  if (!data.access_token) throw new Error('No access token returned — refresh token may be revoked. Reconnect Gmail.');
  return data.access_token;
}

function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts) {
    // Prefer plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    // Recurse into multipart
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
    // Fallback to HTML — strip tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  }
  return '';
}

function header(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export async function POST(req: NextRequest) {
  try {
    const { caseId, afterDate = '', senderFilter = '', maxEmails = 100 } = await req.json();
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s = Object.fromEntries(settings.map(r => [r.key, r.value]));

    const clientId     = s['gmail_client_id']     || '';
    const clientSecret = s['gmail_client_secret']  || '';
    const refreshToken = s['gmail_refresh_token']  || '';
    const apiKey       = s['openai_api_key']?.trim() || process.env.OPENAI_API_KEY || '';

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json({ error: 'Gmail not connected. Configure credentials in the scanner panel and connect.' }, { status: 400 });
    }
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });

    const caseContext = s['main_chat_system_prompt'] || s['system_prompt_main'] || s['custom_system_prompt'] || '';

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // Build Gmail search query from structured filters
    const parts: string[] = [];
    if (afterDate) {
      const d = new Date(afterDate);
      parts.push(`after:${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`);
    }
    if (senderFilter) parts.push(`from:${senderFilter}`);
    const query = parts.join(' ');

    // List messages
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('maxResults', String(Math.min(Number(maxEmails), 200)));
    if (query) listUrl.searchParams.set('q', query);

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) throw new Error(`Gmail list failed (${listRes.status}) — check permissions`);

    const { messages = [] } = await listRes.json();

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

    // Process up to 50 per run
    const toProcess = (messages as any[]).slice(0, 50);

    for (const msg of toProcess) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) continue;

        const msgData = await msgRes.json();
        const headers  = msgData.payload?.headers || [];
        const subject  = header(headers, 'Subject') || '(no subject)';
        const from     = header(headers, 'From');
        const to       = header(headers, 'To');
        const dateStr  = header(headers, 'Date');
        const msgId    = header(headers, 'Message-ID') || msg.id;
        const body     = extractBody(msgData.payload);

        const checksumId = crypto.createHash('sha256').update(msgId + from + dateStr).digest('hex');
        if (existingIds.has(checksumId)) { skipped++; continue; }
        const already = db.prepare('SELECT id FROM evidence WHERE checksum = ?').get(checksumId);
        if (already) { skipped++; continue; }

        if (!body.trim() && !subject.trim()) { skipped++; continue; }

        const fullText = `Subject: ${subject}\nFrom: ${from}\nTo: ${to}\nDate: ${dateStr}\n\n${body}`;
        const triage   = await triageDocument(apiKey, subject || 'email', fullText, caseContext);
        if (!triage.is_relevant) { skipped++; continue; }

        // Build filename
        let dateSlug = new Date().toISOString().split('T')[0];
        try { dateSlug = new Date(dateStr).toISOString().split('T')[0]; } catch {}
        const senderSlug  = from.replace(/<[^>]+>/, '').replace(/[^a-z0-9]/gi, '-').substring(0, 20).toLowerCase().replace(/-+$/,'');
        const subjectSlug = subject.replace(/[^a-z0-9]/gi, '-').substring(0, 30).toLowerCase();
        const filename    = `${dateSlug}-${senderSlug}-${subjectSlug}.eml`;

        newItems.push({
          id:                checksumId,
          filename,
          memory_type:       triage.memory_type       || 'neutral',
          party:             triage.party              || 'neutral',
          document_type:     'email communication',
          actual_author:     triage.actual_author      || from,
          submitted_by_party: triage.party             || 'neutral',
          extracted_text:    fullText,
          key_dates:         triage.key_dates          || [],
          key_entities:      triage.key_entities       || [],
          key_claims:        triage.key_claims          || [],
          document_tone:     triage.document_tone       || 'neutral',
          legal_areas:       triage.legal_areas         || [],
          cause_of_action:   triage.cause_of_action     || null,
          legal_significance: triage.legal_significance || null,
          source_account:    'gmail',
          sender:            from,
          recipients:        [to],
          subject,
          date_received:     dateSlug,
          thread_id:         msgData.threadId || null,
          scanned_at:        new Date().toISOString(),
        });

        existingIds.add(checksumId);
        queued++;
      } catch (err: any) {
        errors.push(`Message ${msg.id}: ${err.message}`);
      }
    }

    if (newItems.length > 0) {
      existingQueue.push(...newItems);
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(existingQueue, null, 2), 'utf-8');
    }

    const remaining = messages.length - toProcess.length;
    const msg2 = `${queued} emails queued, ${skipped} already seen.${remaining > 0 ? ` ${remaining} more available — run again.` : ''}`;
    return NextResponse.json({ queued, skipped, errors, remaining, message: msg2 });
  } catch (error: any) {
    console.error('[scan-email]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
