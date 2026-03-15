import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

const REDIRECT_URI = 'http://localhost:3004/api/evidence/outlook-auth/callback';
// Mail.Read + offline_access (for refresh tokens)
const SCOPES = 'https://graph.microsoft.com/Mail.Read offline_access';

// GET ?action=start   → return OAuth URL
// GET ?action=status  → connected?
// GET ?code=...       → callback, exchange for tokens
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const code   = searchParams.get('code');

  // ── Status ────────────────────────────────────────────────────────────────
  if (action === 'status') {
    const token = db.prepare("SELECT value FROM settings WHERE key = 'outlook_refresh_token'").get() as any;
    return NextResponse.json({ connected: !!token?.value });
  }

  // ── Start OAuth ───────────────────────────────────────────────────────────
  if (action === 'start') {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'outlook_client_id'").get() as any;
    if (!row?.value) {
      return NextResponse.json({ error: 'Outlook Application (Client) ID not configured' }, { status: 400 });
    }

    const url = new URL(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id',     row.value);
    url.searchParams.set('redirect_uri',  REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope',         SCOPES);
    url.searchParams.set('response_mode', 'query');

    return NextResponse.json({ url: url.toString() });
  }

  // ── Callback ──────────────────────────────────────────────────────────────
  if (code) {
    const getS = (key: string) => (db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as any)?.value || '';
    const clientId     = getS('outlook_client_id');
    const clientSecret = getS('outlook_client_secret');

    if (!clientId || !clientSecret) {
      return htmlResponse('Auth failed — client credentials not found. Please set them in LegalMind and try again.', false);
    }

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
        scope:         SCOPES,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return htmlResponse(`Token exchange failed: ${err}`, false);
    }

    const tokens = await tokenRes.json();
    if (tokens.refresh_token) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('outlook_refresh_token', ?)").run(tokens.refresh_token);
    }

    // Get email address from /me
    let email = 'your account';
    try {
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        email = me.mail || me.userPrincipalName || email;
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('outlook_connected_email', ?)").run(email);
      }
    } catch { /* non-critical */ }

    return htmlResponse(`Outlook connected: ${email}`, true);
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

export async function DELETE() {
  db.prepare("DELETE FROM settings WHERE key IN ('outlook_refresh_token','outlook_connected_email')").run();
  return NextResponse.json({ success: true });
}
