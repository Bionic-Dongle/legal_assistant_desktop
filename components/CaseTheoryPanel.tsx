'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Scale, BookOpen, Gavel } from 'lucide-react';

interface DetectedClaim {
  claim_id: string;
  label: string;
  confidence: number;
  confidence_band: 'high' | 'medium' | 'low';
  triggered_signals: string[];
  framework_id: string;
  description: string;
}

interface FrameworkElement {
  element_id: string;
  label: string;
  description: string;
  evidence_prompt: string;
}

interface Framework {
  framework_id: string;
  claim: string;
  elements: FrameworkElement[];
}

interface Authority {
  citation: string;
  title: string;
  court: string;
  year: string;
  url: string;
  principle: string;
  relevance: string;
  key_passage: string;
}

interface AnalysisResult {
  detected_claims: DetectedClaim[];
  frameworks: Framework[];
  authorities: Authority[];
  signal_counts: Record<string, number>;
}

const BAND_COLOURS = {
  high:   { bar: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  medium: { bar: 'bg-amber-500',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  low:    { bar: 'bg-cyan-600',   badge: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30' },
};

function SignalLabel({ signal }: { signal: string }) {
  const label = signal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50 mr-1 mb-1">
      {label}
    </span>
  );
}

function ClaimCard({ claim, framework }: { claim: DetectedClaim; framework?: Framework }) {
  const [open, setOpen] = useState(false);
  const colours = BAND_COLOURS[claim.confidence_band];
  const pct = Math.round(claim.confidence * 100);

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden mb-3">
      {/* Header row */}
      <button
        className="w-full flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colours.badge}`}>
              {pct}%
            </span>
            <span className="text-sm font-semibold truncate">{claim.label}</span>
          </div>
          {/* Confidence bar */}
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${colours.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="mt-0.5 text-muted-foreground flex-shrink-0">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/40">
          <p className="text-xs text-muted-foreground mt-2">{claim.description}</p>

          {/* Triggered signals */}
          {claim.triggered_signals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Triggered by</p>
              <div>
                {claim.triggered_signals.map(s => <SignalLabel key={s} signal={s} />)}
              </div>
            </div>
          )}

          {/* Framework elements */}
          {framework && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Elements to establish</p>
              <div className="space-y-2">
                {framework.elements.map(el => (
                  <div key={el.element_id} className="pl-2 border-l-2 border-primary/30">
                    <p className="text-xs font-semibold">{el.label}</p>
                    <p className="text-xs text-muted-foreground">{el.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuthorityCard({ auth }: { auth: Authority }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden mb-2">
      <button
        className="w-full flex items-start gap-2 p-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <Gavel className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug">{auth.citation || auth.title}</p>
          {auth.court && <p className="text-xs text-muted-foreground">{auth.court}{auth.year ? ` · ${auth.year}` : ''}</p>}
        </div>
        <div className="text-muted-foreground flex-shrink-0">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 text-xs">
          {auth.principle && (
            <div className="mt-2">
              <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Principle</p>
              <p>{auth.principle}</p>
            </div>
          )}
          {auth.relevance && (
            <div>
              <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Relevance</p>
              <p>{auth.relevance}</p>
            </div>
          )}
          {auth.key_passage && (
            <div>
              <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Key passage</p>
              <p className="italic text-muted-foreground">"{auth.key_passage}"</p>
            </div>
          )}
          {auth.url && (
            <a
              href={auth.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={e => {
                e.preventDefault();
                if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternalUrl) {
                  (window as any).electronAPI.openExternalUrl(auth.url);
                } else {
                  window.open(auth.url, '_blank');
                }
              }}
            >
              View on AustLII →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function CaseTheoryPanel({ caseId }: { caseId: string }) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [austliiLoading, setAustliiLoading] = useState(false);
  const [error, setError] = useState('');

  const runAnalysis = useCallback(async (fetchAustlii = false) => {
    if (fetchAustlii) {
      setAustliiLoading(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await fetch('/api/legal/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, fetchAustlii }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAnalysis(prev => ({
        ...data,
        // Keep existing authorities if we're not doing an AustLII fetch
        authorities: fetchAustlii ? data.authorities : (prev?.authorities ?? []),
      }));
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
      setAustliiLoading(false);
    }
  }, [caseId]);

  // Auto-run when we have a caseId (no AustLII — fast)
  useEffect(() => {
    if (caseId) runAnalysis(false);
  }, [caseId]);

  const frameworkMap = new Map(analysis?.frameworks?.map(f => [f.framework_id, f]) ?? []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider">Case Theory</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => runAnalysis(false)}
          disabled={loading}
          title="Refresh analysis"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {error && (
          <p className="text-xs text-red-400 mb-3 p-2 rounded bg-red-500/10 border border-red-500/20">{error}</p>
        )}

        {loading && !analysis && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-xs">Analysing evidence...</p>
          </div>
        )}

        {!loading && analysis && analysis.detected_claims.length === 0 && (
          <div className="text-center text-muted-foreground py-8 px-2">
            <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No claims detected yet.</p>
            <p className="text-xs mt-1 opacity-70">Upload and analyse evidence to activate this panel.</p>
          </div>
        )}

        {analysis && analysis.detected_claims.length > 0 && (
          <>
            {/* Claims */}
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Detected Claims
              </p>
              {analysis.detected_claims.map(claim => (
                <ClaimCard
                  key={claim.claim_id}
                  claim={claim}
                  framework={frameworkMap.get(claim.framework_id)}
                />
              ))}
            </div>

            {/* AustLII authorities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Authorities
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs px-2"
                  onClick={() => runAnalysis(true)}
                  disabled={austliiLoading}
                >
                  {austliiLoading ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Fetching...</>
                  ) : (
                    analysis.authorities?.length ? 'Refresh' : 'Fetch AustLII'
                  )}
                </Button>
              </div>

              {austliiLoading && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                  Searching AustLII...
                </div>
              )}

              {!austliiLoading && analysis.authorities?.length > 0 && (
                analysis.authorities.map((auth, i) => (
                  <AuthorityCard key={i} auth={auth} />
                ))
              )}

              {!austliiLoading && (!analysis.authorities || analysis.authorities.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-3 opacity-60">
                  Click "Fetch AustLII" to retrieve relevant case law
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
