import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

const REDIRECT_URI = 'http://localhost:3004/api/evidence/gmail-auth/callback';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

// GET ?action=start   → return OAuth URL to open in browser
// GET ?action=status  → check if connected
// GET ?code=...       → OAuth callback — exchange code for tokens
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const code   = searchParams.get('code');

  // ── Status check ─────────────────────────────────────────────────────────
  if (action === 'status') {
    const token = db.prepare("SELECT value FROM settings WHERE key = 'gmail_refresh_token'").get() as any;
    return NextResponse.json({ connected: !!token?.value });
  }

  // ── Start OAuth ───────────────────────────────────────────────────────────
  if (action === 'start') {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'gmail_client_id'").get() as any;
    if (!row?.value) {
      return NextResponse.json({ error: 'Gmail Client ID not configured in Settings' }, { status: 400 });
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id',     row.value);
    url.searchParams.set('redirect_uri',  REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope',         SCOPES);
    url.searchParams.set('access_type',   'offline');
    url.searchParams.set('prompt',        'consent');

    return NextResponse.json({ url: url.toString() });
  }

  // ── OAuth callback ────────────────────────────────────────────────────────
  if (code) {
    const getS = (key: string) => (db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as any)?.value || '';
    const clientId     = getS('gmail_client_id');
    const clientSecret = getS('gmail_client_secret');

    if (!clientId || !clientSecret) {
      return htmlResponse('Auth failed — client credentials not found. Please set them in LegalMind and try again.', false);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return htmlResponse(`Token exchange failed: ${err}`, false);
    }

    const tokens = await tokenRes.json();
    if (tokens.refresh_token) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('gmail_refresh_token', ?)").run(tokens.refresh_token);
    }

    // Fetch account email for confirmation
    let email = 'your account';
    try {
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        email = profile.emailAddress || email;
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('gmail_connected_email', ?)").run(email);
      }
    } catch { /* non-critical */ }

    return htmlResponse(`Gmail connected: ${email}`, true);
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

function htmlResponse(message: string, success: boolean) {
  const color = success ? '#22c55e' : '#ef4444';
  const icon  = success ? '✓' : '✗';
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:60px;text-align:center;background:#0f0f14;color:#e2e8f0">
      <h2 style="color:${color};font-size:2rem">${icon} ${message}</h2>
      <p style="color:#94a3b8;margin-top:16px">You can close this tab and return to LegalMind.</p>
      <script>setTimeout(() => window.close(), 3000)</script>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// Disconnect — DELETE clears the stored token
export async function DELETE() {
  db.prepare("DELETE FROM settings WHERE key IN ('gmail_refresh_token','gmail_connected_email')").run();
  return NextResponse.json({ success: true });
}
