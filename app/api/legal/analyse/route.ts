/**
 * app/api/legal/analyse/route.ts
 *
 * Full legal analysis pipeline:
 *   1. Load case evidence from DB
 *   2. Extract legal signals
 *   3. Detect claims (weighted scoring)
 *   4. Activate doctrinal frameworks
 *   5. Fetch AustLII authorities
 *   6. Return structured result for chat injection + UI display
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { extractSignalsFromEvidenceSet } from '@/lib/signal-extractor';
import { detectClaims } from '@/lib/claim-detection-library';
import { getFrameworksForClaims, buildFrameworkContext } from '@/lib/doctrinal-frameworks';
import { fetchAuthorities, buildAuthorityContext } from '@/lib/austlii';

export async function POST(req: NextRequest) {
  try {
    const { caseId, fetchAustlii = true } = await req.json();
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s = Object.fromEntries(settings.map(r => [r.key, r.value]));
    const apiKey = s['openai_api_key']?.trim() || process.env.OPENAI_API_KEY || '';

    // ── 1. Load evidence for this case ────────────────────────────────────
    const evidence = db.prepare(`
      SELECT extracted_text, key_claims, key_entities, legal_significance,
             document_type, document_tone, actual_author, memory_type
      FROM evidence WHERE case_id = ?
    `).all(caseId) as any[];

    // Parse JSON fields
    const evidenceItems = evidence.map((e: any) => ({
      ...e,
      key_claims:   tryParse(e.key_claims,   []),
      key_entities: tryParse(e.key_entities, []),
    }));

    // ── 2. Extract legal signals ──────────────────────────────────────────
    const { signals, signal_counts } = extractSignalsFromEvidenceSet(evidenceItems);

    // ── 3. Detect claims ──────────────────────────────────────────────────
    const detectedClaims = detectClaims(signals);

    // ── 4. Load doctrinal frameworks ──────────────────────────────────────
    const frameworkIds = detectedClaims.map(c => c.framework_id);
    const frameworks   = getFrameworksForClaims(frameworkIds);
    const frameworkContext = buildFrameworkContext(frameworks);

    // ── 5. Fetch AustLII authorities (for top claims) ─────────────────────
    let authorities:     any[]   = [];
    let authorityContext: string = '';

    if (fetchAustlii && apiKey && detectedClaims.length > 0) {
      // Gather authority queries from top 3 detected frameworks
      const topFrameworks = frameworks.slice(0, 3);
      const queries = topFrameworks.flatMap(f => f.authority_queries).slice(0, 6);

      try {
        authorities      = await fetchAuthorities(queries, apiKey, 4);
        authorityContext = buildAuthorityContext(authorities);
      } catch (e) {
        console.warn('[legal/analyse] AustLII fetch failed:', e);
      }
    }

    // ── 6. Build combined context for LLM injection ───────────────────────
    const legalContext = [
      detectedClaims.length > 0
        ? `## Detected Legal Claims\n${detectedClaims.map(c =>
            `- **${c.label}** (confidence: ${Math.round(c.confidence * 100)}%): ${c.description}`
          ).join('\n')}`
        : '',
      frameworkContext,
      authorityContext,
    ].filter(Boolean).join('\n\n');

    return NextResponse.json({
      signals,
      signal_counts,
      detected_claims: detectedClaims,
      frameworks:      frameworks.map(f => ({
        framework_id: f.framework_id,
        claim:        f.claim,
        elements:     f.elements,
      })),
      authorities,
      legal_context:   legalContext,   // Ready to inject into chat prompt
    });
  } catch (error: any) {
    console.error('[legal/analyse]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function tryParse(val: any, fallback: any) {
  if (Array.isArray(val)) return val;
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}
