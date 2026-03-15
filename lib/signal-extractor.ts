/**
 * lib/signal-extractor.ts
 *
 * Extracts legal signals from three sources:
 *   1. Document text (keyword matching against signals-registry)
 *   2. Evidence metadata (key_claims, key_entities, legal_significance)
 *   3. Entity graph relationships (when available)
 *
 * Returns a deduplicated set of LegalSignal values for input
 * to the claim detection engine.
 */

import { LegalSignal, SIGNAL_KEYWORDS } from './signals-registry';

export interface EvidenceItem {
  extracted_text?:    string;
  key_claims?:        string[] | string;
  key_entities?:      string[] | string;
  legal_significance?: string;
  document_type?:     string;
  document_tone?:     string;
  actual_author?:     string;
  memory_type?:       string;
}

/**
 * Extract signals from a single text block via keyword matching.
 */
export function extractSignalsFromText(text: string): LegalSignal[] {
  const lower   = text.toLowerCase();
  const signals = new Set<LegalSignal>();

  for (const [signal, keywords] of Object.entries(SIGNAL_KEYWORDS) as [LegalSignal, string[]][]) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      signals.add(signal);
    }
  }

  return Array.from(signals);
}

/**
 * Extract signals from a single evidence item.
 * Combines text, metadata, and document-type heuristics.
 */
export function extractSignalsFromEvidence(item: EvidenceItem): LegalSignal[] {
  const signals = new Set<LegalSignal>();

  // Build combined text from all text fields
  const claimsText   = Array.isArray(item.key_claims)   ? item.key_claims.join(' ')   : (item.key_claims   || '');
  const entitiesText = Array.isArray(item.key_entities) ? item.key_entities.join(' ') : (item.key_entities || '');

  const combined = [
    item.extracted_text    || '',
    claimsText,
    entitiesText,
    item.legal_significance || '',
    item.document_type      || '',
    item.actual_author      || '',
  ].join(' ');

  extractSignalsFromText(combined).forEach(s => signals.add(s));

  // Document-type heuristics — some document types are inherently strong signals
  const docType = (item.document_type || '').toLowerCase();
  if (docType.includes('power of attorney') || docType.includes('poa')) {
    signals.add('attorney_under_power_of_attorney');
    signals.add('fiduciary_relationship');
  }
  if (docType.includes('contract of sale') || docType.includes('settlement')) {
    signals.add('sale_of_property');
    signals.add('property_transfer_or_sale');
  }
  if (docType.includes('mortgage') || docType.includes('refinanc')) {
    signals.add('mortgage_or_refinancing');
    signals.add('refinancing_event');
  }
  if (docType.includes('affidavit') || docType.includes('statement')) {
    // Affidavits often contain representations — flag for review
    if (combined.toLowerCase().includes('yours') || combined.toLowerCase().includes('your property')) {
      signals.add('representation_or_assurance');
    }
  }

  // Tone heuristic — hostile opposition documents may signal conflict
  if (item.document_tone === 'hostile' && item.memory_type === 'opposition') {
    signals.add('refusal_to_comply_with_request');
  }

  return Array.from(signals);
}

/**
 * Aggregate signals across all evidence items for a case.
 * Returns deduplicated signal set + per-signal occurrence count
 * (higher count = stronger signal strength).
 */
export function extractSignalsFromEvidenceSet(items: EvidenceItem[]): {
  signals:     LegalSignal[];
  signal_counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const itemSignals = extractSignalsFromEvidence(item);
    for (const s of itemSignals) {
      counts[s] = (counts[s] || 0) + 1;
    }
  }

  // Sort by occurrence count (strongest signals first)
  const signals = (Object.keys(counts) as LegalSignal[])
    .sort((a, b) => counts[b] - counts[a]);

  return { signals, signal_counts: counts };
}
