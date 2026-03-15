/**
 * lib/claim-detection-library.ts
 *
 * Maps legal signals → candidate causes of action using weighted confidence scoring.
 * Each claim has:
 *   - trigger_signals with individual weights (sum to 1.0)
 *   - minimum_trigger_count threshold
 *   - framework_id linking to the doctrinal framework registry
 *
 * Source: Legal Academy Case Law Research Assistant schema.
 */

import { LegalSignal } from './signals-registry';

export type ClaimId =
  | 'constructive_trust'
  | 'proprietary_estoppel'
  | 'breach_fiduciary_duty'
  | 'accessory_liability_breach_of_trust'
  | 'litigation_guardian_conflict'
  | 'poa_breach_of_duty'
  | 'personal_costs_order';

export interface ClaimTrigger {
  signal:  LegalSignal;
  weight:  number;          // contribution to confidence score (weights per claim sum to 1.0)
}

export interface ClaimDefinition {
  claim_id:              ClaimId;
  label:                 string;
  jurisdiction:          string;
  category:              string;
  description:           string;
  trigger_signals:       ClaimTrigger[];
  minimum_trigger_count: number;
  framework_id:          string;
}

export interface DetectedClaim {
  claim_id:         ClaimId;
  label:            string;
  confidence:       number;           // weighted score 0–1
  confidence_band:  'high' | 'medium' | 'low';
  triggered_signals: LegalSignal[];
  framework_id:     string;
  description:      string;
}

export const CLAIM_DETECTION_LIBRARY: ClaimDefinition[] = [
  {
    claim_id:     'constructive_trust',
    label:        'Constructive Trust',
    jurisdiction: 'Australia',
    category:     'Equity',
    description:  'A beneficial interest in property arising from common intention, contribution, and reliance — even where legal title is held by another.',
    framework_id: 'constructive_trust_framework',
    minimum_trigger_count: 2,
    trigger_signals: [
      { signal: 'financial_contribution_to_property', weight: 0.30 },
      { signal: 'improvement_to_property',            weight: 0.20 },
      { signal: 'expectation_of_ownership',           weight: 0.20 },
      { signal: 'long_term_property_management',      weight: 0.15 },
      { signal: 'reliance_conduct',                   weight: 0.10 },
      { signal: 'beneficial_interest_claim',          weight: 0.05 },
    ],
  },

  {
    claim_id:     'proprietary_estoppel',
    label:        'Proprietary Estoppel',
    jurisdiction: 'Australia',
    category:     'Equity',
    description:  'An equitable claim where a representation of property rights was made, relied upon to detriment — making it unconscionable to deny the interest.',
    framework_id: 'proprietary_estoppel_framework',
    minimum_trigger_count: 2,
    trigger_signals: [
      { signal: 'representation_or_assurance',      weight: 0.40 },
      { signal: 'reliance_conduct',                 weight: 0.25 },
      { signal: 'detrimental_action',               weight: 0.20 },
      { signal: 'expectation_created_by_defendant', weight: 0.10 },
      { signal: 'promise_or_agreement',             weight: 0.05 },
    ],
  },

  {
    claim_id:     'breach_fiduciary_duty',
    label:        'Breach of Fiduciary Duty',
    jurisdiction: 'Australia',
    category:     'Equity',
    description:  'A fiduciary (e.g. attorney under POA) acted contrary to their duty of loyalty — typically by acting in their own interest rather than the principal\'s.',
    framework_id: 'fiduciary_duty_framework',
    minimum_trigger_count: 2,
    trigger_signals: [
      { signal: 'fiduciary_relationship',            weight: 0.35 },
      { signal: 'attorney_under_power_of_attorney',  weight: 0.25 },
      { signal: 'benefit_to_fiduciary',              weight: 0.20 },
      { signal: 'self_dealing_transaction',          weight: 0.10 },
      { signal: 'failure_to_act_in_best_interest',   weight: 0.10 },
    ],
  },

  {
    claim_id:     'accessory_liability_breach_of_trust',
    label:        'Accessory Liability (Barnes v Addy)',
    jurisdiction: 'Australia',
    category:     'Equity',
    description:  'Third-party liability for knowing receipt of trust property, or knowing assistance in a breach of fiduciary duty.',
    framework_id: 'barnes_v_addy_framework',
    minimum_trigger_count: 2,
    trigger_signals: [
      { signal: 'third_party_involvement', weight: 0.30 },
      { signal: 'knowledge_of_breach',     weight: 0.30 },
      { signal: 'knowing_assistance',      weight: 0.20 },
      { signal: 'inducement_of_breach',    weight: 0.10 },
      { signal: 'receipt_of_trust_property', weight: 0.10 },
    ],
  },

  {
    claim_id:     'litigation_guardian_conflict',
    label:        'Litigation Guardian — Conflict of Interest',
    jurisdiction: 'Australia',
    category:     'Procedural',
    description:  'A litigation guardian had a personal interest in the proceedings adverse to the party they represent — constituting a disqualifying conflict requiring removal.',
    framework_id: 'litigation_guardian_framework',
    minimum_trigger_count: 2,
    trigger_signals: [
      { signal: 'litigation_guardian_role',         weight: 0.35 },
      { signal: 'conflict_of_interest',             weight: 0.30 },
      { signal: 'personal_interest_in_litigation',  weight: 0.20 },
      { signal: 'procedural_conflict_of_interest',  weight: 0.15 },
    ],
  },

  {
    claim_id:     'poa_breach_of_duty',
    label:        'Power of Attorney — Breach of Duty',
    jurisdiction: 'Australia',
    category:     'Equity',
    description:  'An attorney under an Enduring Power of Attorney failed to act in the principal\'s best interests, or acted in a manner benefiting themselves at the principal\'s expense.',
    framework_id: 'poa_duty_framework',
    minimum_trigger_count: 2,
    trigger_signals: [
      { signal: 'attorney_under_power_of_attorney', weight: 0.35 },
      { signal: 'failure_to_act_in_best_interest',  weight: 0.25 },
      { signal: 'self_dealing_transaction',         weight: 0.20 },
      { signal: 'sale_of_property',                 weight: 0.10 },
      { signal: 'benefit_to_fiduciary',             weight: 0.10 },
    ],
  },

  {
    claim_id:     'personal_costs_order',
    label:        'Personal Costs Order',
    jurisdiction: 'Australia',
    category:     'Costs',
    description:  'A party unreasonably prolonged or continued litigation despite warnings, creating exposure to a personal costs order.',
    framework_id: 'costs_order_framework',
    minimum_trigger_count: 2,
    trigger_signals: [
      { signal: 'continuation_after_warning',      weight: 0.40 },
      { signal: 'refusal_to_comply_with_request',  weight: 0.30 },
      { signal: 'costs_dispute',                   weight: 0.20 },
      { signal: 'procedural_application',          weight: 0.10 },
    ],
  },
];

/**
 * Run claim detection against a set of detected signals.
 * Returns claims sorted by confidence score (highest first).
 */
export function detectClaims(detectedSignals: LegalSignal[]): DetectedClaim[] {
  const signalSet = new Set(detectedSignals);
  const results: DetectedClaim[] = [];

  for (const claim of CLAIM_DETECTION_LIBRARY) {
    const matched = claim.trigger_signals.filter(t => signalSet.has(t.signal));

    if (matched.length < claim.minimum_trigger_count) continue;

    // Weighted confidence = sum of matched signal weights
    const confidence = matched.reduce((sum, t) => sum + t.weight, 0);

    const confidence_band: 'high' | 'medium' | 'low' =
      confidence >= 0.55 ? 'high' :
      confidence >= 0.30 ? 'medium' : 'low';

    results.push({
      claim_id:          claim.claim_id,
      label:             claim.label,
      confidence:        Math.round(confidence * 100) / 100,
      confidence_band,
      triggered_signals: matched.map(t => t.signal),
      framework_id:      claim.framework_id,
      description:       claim.description,
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
