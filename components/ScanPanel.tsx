'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { FolderOpen, Mail, Scan, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface ScanPanelProps {
  caseId: string;
  onQueueUpdated: () => void;
}

const DATE_RANGE_OPTIONS = [
  { label: 'Last 30 days',  value: '30d' },
  { label: 'Last 90 days',  value: '90d' },
  { label: 'Last 6 months', value: '6m'  },
  { label: 'Last year',     value: '1y'  },
  { label: 'Last 2 years',  value: '2y'  },
  { label: 'Last 3 years',  value: '3y'  },
  { label: 'All time',      value: 'all' },
];

function toAfterDate(range: string): string {
  if (range === 'all') return '';
  const now = new Date();
  switch (range) {
    case '30d': now.setDate(now.getDate() - 30); break;
    case '90d': now.setDate(now.getDate() - 90); break;
    case '6m':  now.setMonth(now.getMonth() - 6); break;
    case '1y':  now.setFullYear(now.getFullYear() - 1); break;
    case '2y':  now.setFullYear(now.getFullYear() - 2); break;
    case '3y':  now.setFullYear(now.getFullYear() - 3); break;
  }
  return now.toISOString();
}

export function ScanPanel({ caseId, onQueueUpdated }: ScanPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Folder scanner
  const [plaintiffFolder, setPlaintiffFolder] = useState('');
  const [defenceFolder,   setDefenceFolder]   = useState('');
  const [scanningFolders, setScanningFolders] = useState(false);
  const [folderMsg,       setFolderMsg]       = useState('');

  // Shared email filter state
  const [dateRange,     setDateRange]     = useState('1y');
  const [senderFilter,  setSenderFilter]  = useState('');

  // Gmail
  const [gmailConnected,    setGmailConnected]    = useState(false);
  const [gmailEmail,        setGmailEmail]        = useState('');
  const [gmailClientId,     setGmailClientId]     = useState('');
  const [gmailClientSecret, setGmailClientSecret] = useState('');
  const [scanningGmail,     setScanningGmail]     = useState(false);
  const [gmailMsg,          setGmailMsg]          = useState('');
  const [showGmailSetup,    setShowGmailSetup]    = useState(false);

  // Outlook
  const [outlookConnected,    setOutlookConnected]    = useState(false);
  const [outlookEmail,        setOutlookEmail]        = useState('');
  const [outlookClientId,     setOutlookClientId]     = useState('');
  const [outlookClientSecret, setOutlookClientSecret] = useState('');
  const [scanningOutlook,     setScanningOutlook]     = useState(false);
  const [outlookMsg,          setOutlookMsg]          = useState('');
  const [showOutlookSetup,    setShowOutlookSetup]    = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res  = await fetch('/api/settings');
      const data = await res.json();
      if (data.scan_plaintiff_folder)  setPlaintiffFolder(data.scan_plaintiff_folder);
      if (data.scan_defence_folder)    setDefenceFolder(data.scan_defence_folder);
      if (data.gmail_client_id)        setGmailClientId(data.gmail_client_id);
      if (data.gmail_client_secret)    setGmailClientSecret(data.gmail_client_secret);
      if (data.gmail_connected_email)  setGmailEmail(data.gmail_connected_email);
      if (data.outlook_client_id)      setOutlookClientId(data.outlook_client_id);
      if (data.outlook_client_secret)  setOutlookClientSecret(data.outlook_client_secret);
      if (data.outlook_connected_email) setOutlookEmail(data.outlook_connected_email);
      if (data.scan_date_range)        setDateRange(data.scan_date_range);
      if (data.scan_sender_filter)     setSenderFilter(data.scan_sender_filter);

      const [gRes, oRes] = await Promise.all([
        fetch('/api/evidence/gmail-auth?action=status'),
        fetch('/api/evidence/outlook-auth?action=status'),
      ]);
      setGmailConnected((await gRes.json()).connected);
      setOutlookConnected((await oRes.json()).connected);
    } catch { /* non-critical */ }
  };

  const save = (key: string, value: string) =>
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });

  // ── Folder picker ─────────────────────────────────────────────────────────
  const browseFolder = async (side: 'plaintiff' | 'defence') => {
    try {
      const result = await (window as any).electronAPI?.selectFolder?.();
      if (!result) return;
      if (side === 'plaintiff') { setPlaintiffFolder(result); save('scan_plaintiff_folder', result); }
      else                      { setDefenceFolder(result);   save('scan_defence_folder', result);   }
    } catch {
      toast.error('Folder picker not available — paste the path manually');
    }
  };

  // ── Folder scan + import ──────────────────────────────────────────────────
  const importFolders = async () => {
    if (!plaintiffFolder && !defenceFolder) {
      toast.error('Set at least one folder path first');
      return;
    }
    setScanningFolders(true);
    setFolderMsg('AI is reading and classifying files…');
    try {
      const scanRes  = await fetch('/api/evidence/scan-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plaintiffFolder, defenceFolder, caseId }),
      });
      const scanData = await scanRes.json();
      if (scanData.error) { toast.error(scanData.error); return; }

      if (scanData.queued === 0) {
        const msg = scanData.skipped > 0 ? `Nothing new — ${scanData.skipped} files already imported.` : scanData.message;
        setFolderMsg(msg); toast.info(msg); return;
      }

      setFolderMsg(`${scanData.queued} documents classified — importing…`);
      const importRes  = await fetch('/api/evidence/import-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const importData = await importRes.json();
      if (importData.error) { toast.error(importData.error); return; }

      const parts = [];
      if (importData.processed > 0) parts.push(`${importData.processed} imported`);
      if (importData.skipped   > 0) parts.push(`${importData.skipped} already existed`);
      const summary = parts.join(', ');
      const more    = scanData.remaining > 0 ? ` ${scanData.remaining} more files remaining — run again.` : '';
      setFolderMsg(summary + more);
      toast.success(`Done — ${summary}`);
      onQueueUpdated();
    } catch {
      toast.error('Folder import failed — check the console');
    } finally {
      setScanningFolders(false);
    }
  };

  // ── Generic email import (scan + queue + ingest) ──────────────────────────
  const importEmails = async (provider: 'gmail' | 'outlook') => {
    const setScan = provider === 'gmail' ? setScanningGmail : setScanningOutlook;
    const setMsg  = provider === 'gmail' ? setGmailMsg      : setOutlookMsg;
    const scanUrl = provider === 'gmail' ? '/api/evidence/scan-email' : '/api/evidence/scan-outlook';

    setScan(true);
    setMsg('AI is reading and classifying emails…');
    try {
      const afterDate = toAfterDate(dateRange);
      save('scan_date_range',    dateRange);
      save('scan_sender_filter', senderFilter);

      const scanRes  = await fetch(scanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, afterDate, senderFilter }),
      });
      const scanData = await scanRes.json();
      if (scanData.error) { toast.error(scanData.error); return; }

      if (scanData.queued === 0) {
        const msg = scanData.skipped > 0 ? `Nothing new — ${scanData.skipped} emails already imported.` : scanData.message;
        setMsg(msg); toast.info(msg); return;
      }

      setMsg(`${scanData.queued} emails classified — importing…`);
      const importRes  = await fetch('/api/evidence/import-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const importData = await importRes.json();
      if (importData.error) { toast.error(importData.error); return; }

      const parts = [];
      if (importData.processed > 0) parts.push(`${importData.processed} imported`);
      if (importData.skipped   > 0) parts.push(`${importData.skipped} already existed`);
      const summary = parts.join(', ');
      const more    = scanData.remaining > 0 ? ` ${scanData.remaining} more available — run again.` : '';
      setMsg(summary + more);
      toast.success(`Done — ${summary}`);
      onQueueUpdated();
    } catch {
      toast.error('Email import failed');
    } finally {
      setScan(false);
    }
  };

  // ── Gmail connect ─────────────────────────────────────────────────────────
  const connectGmail = async () => {
    if (!gmailClientId || !gmailClientSecret) { toast.error('Enter Client ID and Secret first'); return; }
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_client_id: gmailClientId, gmail_client_secret: gmailClientSecret }) });
    const res  = await fetch('/api/evidence/gmail-auth?action=start');
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    const opened = await (window as any).electronAPI?.openExternalUrl?.(data.url);
    if (!opened) window.open(data.url, '_blank');
    toast.info('Complete authorisation in your browser, then click Check Status');
  };

  const checkGmailStatus = async () => {
    const res  = await fetch('/api/evidence/gmail-auth?action=status');
    const data = await res.json();
    setGmailConnected(data.connected);
    if (data.connected) {
      const sData = await (await fetch('/api/settings')).json();
      setGmailEmail(sData.gmail_connected_email || '');
      toast.success('Gmail connected');
    } else {
      toast.info('Not connected yet — complete the browser auth first');
    }
  };

  // ── Outlook connect ───────────────────────────────────────────────────────
  const connectOutlook = async () => {
    if (!outlookClientId || !outlookClientSecret) { toast.error('Enter Application ID and Secret first'); return; }
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outlook_client_id: outlookClientId, outlook_client_secret: outlookClientSecret }) });
    const res  = await fetch('/api/evidence/outlook-auth?action=start');
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    const opened = await (window as any).electronAPI?.openExternalUrl?.(data.url);
    if (!opened) window.open(data.url, '_blank');
    toast.info('Complete authorisation in your browser, then click Check Status');
  };

  const checkOutlookStatus = async () => {
    const res  = await fetch('/api/evidence/outlook-auth?action=status');
    const data = await res.json();
    setOutlookConnected(data.connected);
    if (data.connected) {
      const sData = await (await fetch('/api/settings')).json();
      setOutlookEmail(sData.outlook_connected_email || '');
      toast.success('Outlook connected');
    } else {
      toast.info('Not connected yet — complete the browser auth first');
    }
  };

  // ── Shared filter bar (used for both Gmail and Outlook) ───────────────────
  const FilterBar = () => (
    <div className="flex gap-2 mb-3">
      <div className="flex flex-col gap-1 flex-1">
        <label className="text-xs text-muted-foreground">Date range</label>
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-border bg-background"
        >
          {DATE_RANGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <label className="text-xs text-muted-foreground">From (email / domain)</label>
        <input
          type="text"
          placeholder="e.g. moores.com.au"
          value={senderFilter}
          onChange={e => setSenderFilter(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-border bg-background"
        />
      </div>
    </div>
  );

  const ConnectedBadge = ({ email }: { email: string }) => (
    <span className="flex items-center gap-1 text-green-500 text-xs font-normal">
      <CheckCircle2 className="h-3 w-3" />{email || 'Connected'}
    </span>
  );

  const NotConnectedBadge = () => (
    <span className="flex items-center gap-1 text-muted-foreground text-xs font-normal">
      <AlertCircle className="h-3 w-3" />Not connected
    </span>
  );

  return (
    <div className="mx-6 mt-3 border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Scan className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Evidence Scanner</span>
          <span className="text-xs text-muted-foreground">— folders, Gmail &amp; Outlook</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-5 border-t border-border">

          {/* ── Folder Scanner ────────────────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Local Folders
            </h4>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="text" placeholder="Plaintiff folder path…" value={plaintiffFolder}
                  onChange={e => { setPlaintiffFolder(e.target.value); save('scan_plaintiff_folder', e.target.value); }}
                  className="flex-1 text-xs px-3 py-1.5 rounded border border-border bg-background font-mono" />
                <Button size="sm" variant="outline" onClick={() => browseFolder('plaintiff')}>Browse</Button>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Defence folder path…" value={defenceFolder}
                  onChange={e => { setDefenceFolder(e.target.value); save('scan_defence_folder', e.target.value); }}
                  className="flex-1 text-xs px-3 py-1.5 rounded border border-border bg-background font-mono" />
                <Button size="sm" variant="outline" onClick={() => browseFolder('defence')}>Browse</Button>
              </div>
              <Button size="sm" onClick={importFolders} disabled={scanningFolders} className="w-full">
                {scanningFolders ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Importing…</> : 'Import Folders'}
              </Button>
              {folderMsg && <p className="text-xs text-muted-foreground">{folderMsg}</p>}
            </div>
          </div>

          <hr className="border-border" />

          {/* ── Shared email filter ───────────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Email Filter</h4>
            <p className="text-xs text-muted-foreground mb-2">Applied to both Gmail and Outlook scans below.</p>
            <FilterBar />
          </div>

          {/* ── Gmail ─────────────────────────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" /> Gmail
              {gmailConnected ? <ConnectedBadge email={gmailEmail} /> : <NotConnectedBadge />}
            </h4>

            {(!gmailConnected || showGmailSetup) && (
              <div className="p-3 bg-muted/20 rounded border border-border text-xs space-y-2 mb-2">
                <p className="text-muted-foreground">
                  <strong>console.cloud.google.com</strong> → APIs &amp; Services → Credentials → OAuth 2.0 Client IDs.<br />
                  Add redirect URI: <code className="bg-muted px-1 rounded">http://localhost:3004/api/evidence/gmail-auth/callback</code>
                </p>
                <input type="text" placeholder="Client ID" value={gmailClientId}
                  onChange={e => setGmailClientId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-border bg-background" />
                <input type="password" placeholder="Client Secret" value={gmailClientSecret}
                  onChange={e => setGmailClientSecret(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-border bg-background" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={connectGmail} className="flex-1">Connect (opens browser)</Button>
                  <Button size="sm" variant="outline" onClick={checkGmailStatus}>Check Status</Button>
                </div>
              </div>
            )}

            {gmailConnected && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => importEmails('gmail')} disabled={scanningGmail} className="flex-1">
                  {scanningGmail ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Importing…</> : 'Import Gmail'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowGmailSetup(s => !s)}>
                  {showGmailSetup ? 'Hide' : 'Re-connect'}
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={async () => { await fetch('/api/evidence/gmail-auth', { method: 'DELETE' }); setGmailConnected(false); setGmailEmail(''); }}>
                  Disconnect
                </Button>
              </div>
            )}
            {gmailMsg && <p className="text-xs text-muted-foreground mt-1">{gmailMsg}</p>}
          </div>

          {/* ── Outlook / Hotmail ─────────────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" /> Outlook / Hotmail
              {outlookConnected ? <ConnectedBadge email={outlookEmail} /> : <NotConnectedBadge />}
            </h4>

            {(!outlookConnected || showOutlookSetup) && (
              <div className="p-3 bg-muted/20 rounded border border-border text-xs space-y-2 mb-2">
                <p className="text-muted-foreground">
                  <strong>portal.azure.com</strong> → App registrations → New registration → Certificates &amp; secrets → New client secret.<br />
                  Under API permissions add <strong>Mail.Read</strong> (delegated).<br />
                  Add redirect URI: <code className="bg-muted px-1 rounded">http://localhost:3004/api/evidence/outlook-auth/callback</code>
                </p>
                <input type="text" placeholder="Application (Client) ID" value={outlookClientId}
                  onChange={e => setOutlookClientId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-border bg-background" />
                <input type="password" placeholder="Client Secret value" value={outlookClientSecret}
                  onChange={e => setOutlookClientSecret(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-border bg-background" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={connectOutlook} className="flex-1">Connect (opens browser)</Button>
                  <Button size="sm" variant="outline" onClick={checkOutlookStatus}>Check Status</Button>
                </div>
              </div>
            )}

            {outlookConnected && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => importEmails('outlook')} disabled={scanningOutlook} className="flex-1">
                  {scanningOutlook ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Importing…</> : 'Import Outlook'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowOutlookSetup(s => !s)}>
                  {showOutlookSetup ? 'Hide' : 'Re-connect'}
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={async () => { await fetch('/api/evidence/outlook-auth', { method: 'DELETE' }); setOutlookConnected(false); setOutlookEmail(''); }}>
                  Disconnect
                </Button>
              </div>
            )}
            {outlookMsg && <p className="text-xs text-muted-foreground mt-1">{outlookMsg}</p>}
          </div>

        </div>
      )}
    </div>
  );
}
