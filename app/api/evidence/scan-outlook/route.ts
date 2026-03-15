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
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
      scope:         'https://graph.microsoft.com/Mail.Read offline_access',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Outlook token — please reconnect in Settings');
  const data = await res.json();
  if (!data.access_token) throw new Error('No access token returned — reconnect Outlook in Settings');
  return data.access_token;
}

function extractOutlookBody(message: any): string {
  const body = message.body;
  if (!body) return '';
  if (body.contentType === 'text') return body.content || '';
  // HTML — strip tags
  return (body.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { caseId, afterDate = '', senderFilter = '', maxEmails = 100 } = await req.json();
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s = Object.fromEntries(settings.map(r => [r.key, r.value]));

    const clientId     = s['outlook_client_id']     || '';
    const clientSecret = s['outlook_client_secret']  || '';
    const refreshToken = s['outlook_refresh_token']  || '';
    const apiKey       = s['openai_api_key']?.trim() || process.env.OPENAI_API_KEY || '';

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json({ error: 'Outlook not connected. Configure credentials and connect.' }, { status: 400 });
    }
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });

    const caseContext = s['main_chat_system_prompt'] || s['system_prompt_main'] || s['custom_system_prompt'] || '';
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // Build Graph API filter
    const filters: string[] = [];
    if (afterDate) filters.push(`receivedDateTime ge ${new Date(afterDate).toISOString()}`);

    const messagesUrl = new URL('https://graph.microsoft.com/v1.0/me/messages');
    messagesUrl.searchParams.set('$top', String(Math.min(Number(maxEmails), 200)));
    messagesUrl.searchParams.set('$select', 'id,subject,from,toRecipients,receivedDateTime,body,internetMessageId,conversationId');
    if (filters.length > 0) messagesUrl.searchParams.set('$filter', filters.join(' and '));
    // Outlook search for sender — use $search if senderFilter provided
    if (senderFilter) messagesUrl.searchParams.set('$search', `"from:${senderFilter}"`);

    const listRes = await fetch(messagesUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' },
    });
    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error(`Outlook messages fetch failed (${listRes.status}): ${err.substring(0, 200)}`);
    }

    const { value: messages = [] } = await listRes.json();

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

    const toProcess = (messages as any[]).slice(0, 50);

    for (const msg of toProcess) {
      try {
        const subject    = msg.subject || '(no subject)';
        const from       = msg.from?.emailAddress?.address || '';
        const fromName   = msg.from?.emailAddress?.name || from;
        const toList     = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).join(', ');
        const receivedAt = msg.receivedDateTime || '';
        const msgId      = msg.internetMessageId || msg.id;
        const body       = extractOutlookBody(msg);

        const checksumId = crypto.createHash('sha256').update(msgId + from + receivedAt).digest('hex');
        if (existingIds.has(checksumId)) { skipped++; continue; }
        const already = db.prepare('SELECT id FROM evidence WHERE checksum = ?').get(checksumId);
        if (already) { skipped++; continue; }

        if (!body.trim() && !subject.trim()) { skipped++; continue; }

        const fullText = `Subject: ${subject}\nFrom: ${fromName} <${from}>\nTo: ${toList}\nDate: ${receivedAt}\n\n${body}`;
        const triage   = await triageDocument(apiKey, subject || 'email', fullText, caseContext);
        if (!triage.is_relevant) { skipped++; continue; }

        let dateSlug = new Date().toISOString().split('T')[0];
        try { dateSlug = new Date(receivedAt).toISOString().split('T')[0]; } catch {}
        const senderSlug  = from.replace(/[^a-z0-9]/gi, '-').substring(0, 20).toLowerCase().replace(/-+$/, '');
        const subjectSlug = subject.replace(/[^a-z0-9]/gi, '-').substring(0, 30).toLowerCase();
        const filename    = `${dateSlug}-${senderSlug}-${subjectSlug}.eml`;

        newItems.push({
          id:                checksumId,
          filename,
          memory_type:       triage.memory_type       || 'neutral',
          party:             triage.party              || 'neutral',
          document_type:     'email communication',
          actual_author:     triage.actual_author      || `${fromName} <${from}>`,
          submitted_by_party: triage.party             || 'neutral',
          extracted_text:    fullText,
          key_dates:         triage.key_dates          || [],
          key_entities:      triage.key_entities       || [],
          key_claims:        triage.key_claims          || [],
          document_tone:     triage.document_tone       || 'neutral',
          legal_areas:       triage.legal_areas         || [],
          cause_of_action:   triage.cause_of_action     || null,
          legal_significance: triage.legal_significance || null,
          source_account:    'outlook',
          sender:            from,
          recipients:        [toList],
          subject,
          date_received:     dateSlug,
          thread_id:         msg.conversationId || null,
          scanned_at:        new Date().toISOString(),
        });

        existingIds.add(checksumId);
        queued++;
      } catch (err: any) {
        errors.push(`${msg.subject || msg.id}: ${err.message}`);
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
    console.error('[scan-outlook]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
