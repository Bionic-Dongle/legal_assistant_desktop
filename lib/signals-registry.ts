/**
 * lib/signals-registry.ts
 *
 * 40-signal legal taxonomy for Australian civil disputes.
 * Covers ~80% of property, fiduciary, trust, equity, and procedural claims.
 *
 * Source: Legal Academy Case Law Research Assistant taxonomy.
 * Organised into 7 categories for extensibility.
 */

export type LegalSignal =
  // Property & equitable interests
  | 'financial_contribution_to_property'
  | 'improvement_to_property'
  | 'long_term_property_management'
  | 'expectation_of_ownership'
  | 'property_title_discrepancy'
  | 'beneficial_interest_claim'
  | 'property_transfer_or_sale'
  | 'mortgage_or_refinancing'
  // Representations & reliance
  | 'representation_or_assurance'
  | 'promise_or_agreement'
  | 'reliance_conduct'
  | 'detrimental_action'
  | 'change_of_position'
  | 'expectation_created_by_defendant'
  // Fiduciary & trust relationships
  | 'fiduciary_relationship'
  | 'attorney_under_power_of_attorney'
  | 'trustee_or_trust_relationship'
  | 'director_or_company_officer'
  | 'conflict_of_interest'
  | 'self_dealing_transaction'
  | 'benefit_to_fiduciary'
  | 'failure_to_act_in_best_interest'
  // Third-party participation
  | 'third_party_involvement'
  | 'inducement_of_breach'
  | 'knowing_assistance'
  | 'knowledge_of_breach'
  | 'receipt_of_trust_property'
  // Transactions & assets
  | 'sale_of_property'
  | 'loan_or_financing_transaction'
  | 'refinancing_event'
  | 'transfer_of_funds'
  | 'asset_control_or_management'
  // Litigation roles & conflicts
  | 'litigation_guardian_role'
  | 'personal_interest_in_litigation'
  | 'procedural_conflict_of_interest'
  | 'legal_representation_overlap'
  // Procedural & conduct signals
  | 'refusal_to_comply_with_request'
  | 'continuation_after_warning'
  | 'procedural_application'
  | 'costs_dispute';

export const SIGNAL_CATEGORIES: Record<string, LegalSignal[]> = {
  'Property & Equitable Interests': [
    'financial_contribution_to_property',
    'improvement_to_property',
    'long_term_property_management',
    'expectation_of_ownership',
    'property_title_discrepancy',
    'beneficial_interest_claim',
    'property_transfer_or_sale',
    'mortgage_or_refinancing',
  ],
  'Representations & Reliance': [
    'representation_or_assurance',
    'promise_or_agreement',
    'reliance_conduct',
    'detrimental_action',
    'change_of_position',
    'expectation_created_by_defendant',
  ],
  'Fiduciary & Trust Relationships': [
    'fiduciary_relationship',
    'attorney_under_power_of_attorney',
    'trustee_or_trust_relationship',
    'director_or_company_officer',
    'conflict_of_interest',
    'self_dealing_transaction',
    'benefit_to_fiduciary',
    'failure_to_act_in_best_interest',
  ],
  'Third-Party Participation': [
    'third_party_involvement',
    'inducement_of_breach',
    'knowing_assistance',
    'knowledge_of_breach',
    'receipt_of_trust_property',
  ],
  'Transactions & Assets': [
    'sale_of_property',
    'loan_or_financing_transaction',
    'refinancing_event',
    'transfer_of_funds',
    'asset_control_or_management',
  ],
  'Litigation Roles & Conflicts': [
    'litigation_guardian_role',
    'personal_interest_in_litigation',
    'procedural_conflict_of_interest',
    'legal_representation_overlap',
  ],
  'Procedural & Conduct': [
    'refusal_to_comply_with_request',
    'continuation_after_warning',
    'procedural_application',
    'costs_dispute',
  ],
};

/** Human-readable labels for UI display */
export const SIGNAL_LABELS: Record<LegalSignal, string> = {
  financial_contribution_to_property:  'Financial contribution to property',
  improvement_to_property:             'Improvements made to property',
  long_term_property_management:       'Long-term property management',
  expectation_of_ownership:            'Expectation of ownership',
  property_title_discrepancy:          'Property title discrepancy',
  beneficial_interest_claim:           'Beneficial interest claimed',
  property_transfer_or_sale:           'Property transferred or sold',
  mortgage_or_refinancing:             'Mortgage or refinancing',
  representation_or_assurance:         'Representation or assurance made',
  promise_or_agreement:                'Promise or agreement',
  reliance_conduct:                    'Reliance conduct',
  detrimental_action:                  'Detrimental action taken',
  change_of_position:                  'Change of position',
  expectation_created_by_defendant:    'Expectation created by defendant',
  fiduciary_relationship:              'Fiduciary relationship',
  attorney_under_power_of_attorney:    'Attorney under Power of Attorney',
  trustee_or_trust_relationship:       'Trustee or trust relationship',
  director_or_company_officer:         'Director or company officer',
  conflict_of_interest:                'Conflict of interest',
  self_dealing_transaction:            'Self-dealing transaction',
  benefit_to_fiduciary:                'Benefit obtained by fiduciary',
  failure_to_act_in_best_interest:     'Failure to act in principal\'s best interest',
  third_party_involvement:             'Third-party involvement',
  inducement_of_breach:                'Inducement of breach',
  knowing_assistance:                  'Knowing assistance in breach',
  knowledge_of_breach:                 'Knowledge of breach',
  receipt_of_trust_property:           'Receipt of trust property',
  sale_of_property:                    'Sale of property',
  loan_or_financing_transaction:       'Loan or financing transaction',
  refinancing_event:                   'Refinancing event',
  transfer_of_funds:                   'Transfer of funds',
  asset_control_or_management:         'Asset control or management',
  litigation_guardian_role:            'Litigation guardian role',
  personal_interest_in_litigation:     'Personal interest in litigation',
  procedural_conflict_of_interest:     'Procedural conflict of interest',
  legal_representation_overlap:        'Legal representation overlap',
  refusal_to_comply_with_request:      'Refusal to comply with request',
  continuation_after_warning:          'Continuation after warning',
  procedural_application:              'Procedural application made',
  costs_dispute:                       'Costs dispute',
};

/**
 * Keywords extracted from document text that suggest each signal.
 * Used by the text-based signal extractor.
 */
export const SIGNAL_KEYWORDS: Record<LegalSignal, string[]> = {
  financial_contribution_to_property:  ['paid', 'deposit', 'funded', 'contributed', 'investment', 'money', 'purchase price', 'renovation cost'],
  improvement_to_property:             ['renovation', 'improvement', 'repair', 'works', 'upgraded', 'refurbished', 'built'],
  long_term_property_management:       ['managed', 'tenants', 'rent', 'maintenance', 'years', 'managed the property', 'property manager'],
  expectation_of_ownership:            ['your property', 'your investment', 'would be yours', 'intended for you', 'expected to own', 'ownership'],
  property_title_discrepancy:          ['title', 'registered owner', 'legal owner', 'beneficial owner', 'held in name'],
  beneficial_interest_claim:           ['beneficial interest', 'equitable interest', 'beneficial owner', 'trust'],
  property_transfer_or_sale:           ['transfer', 'conveyed', 'sold', 'settlement', 'contract of sale'],
  mortgage_or_refinancing:             ['mortgage', 'refinanc', 'loan', 'security', 'charge over'],
  representation_or_assurance:         ['promised', 'assured', 'told me', 'represented', 'agreed', 'yours', 'will be yours', 'always said'],
  promise_or_agreement:                ['agreement', 'promise', 'agreed', 'deal', 'arrangement', 'understanding'],
  reliance_conduct:                    ['reliance', 'relied on', 'acted on', 'based on', 'proceeded on'],
  detrimental_action:                  ['detriment', 'loss', 'expense', 'gave up', 'sacrificed', 'to my detriment'],
  change_of_position:                  ['changed position', 'altered', 'gave up opportunity', 'moved', 'changed circumstances'],
  expectation_created_by_defendant:    ['led me to believe', 'created expectation', 'encouraged', 'induced me'],
  fiduciary_relationship:              ['fiduciary', 'attorney', 'power of attorney', 'trustee', 'guardian', 'duty of loyalty'],
  attorney_under_power_of_attorney:    ['enduring power of attorney', 'attorney', 'epoa', 'poa', 'power of attorney'],
  trustee_or_trust_relationship:       ['trustee', 'trust', 'held on trust', 'trust property'],
  director_or_company_officer:         ['director', 'officer', 'company', 'corporation'],
  conflict_of_interest:                ['conflict of interest', 'conflict', 'adverse interest', 'competing interest', 'disqualified'],
  self_dealing_transaction:            ['self-dealing', 'own benefit', 'personal gain', 'self interest', 'own account'],
  benefit_to_fiduciary:                ['benefit', 'profit', 'gain', 'advantage', 'personal benefit'],
  failure_to_act_in_best_interest:     ['best interest', 'failed to act', 'not in her interest', 'not in his interest', 'principal'],
  third_party_involvement:             ['third party', 'assisted', 'facilitated', 'participated', 'involved'],
  inducement_of_breach:                ['induced', 'procured', 'caused', 'persuaded', 'encouraged the breach'],
  knowing_assistance:                  ['assisted', 'helped', 'knowing', 'with knowledge', 'knowingly'],
  knowledge_of_breach:                 ['knew', 'aware', 'knowledge', 'notice', 'informed of', 'told about'],
  receipt_of_trust_property:           ['received', 'proceeds', 'received the funds', 'received the property'],
  sale_of_property:                    ['sold', 'sale', 'contract of sale', 'settlement', 'vendor', 'purchaser'],
  loan_or_financing_transaction:       ['loan', 'borrowed', 'lender', 'finance', 'credit facility'],
  refinancing_event:                   ['refinanc', 'new mortgage', 'replaced the loan', 'new loan'],
  transfer_of_funds:                   ['transferred', 'funds transferred', 'payment', 'deposit paid'],
  asset_control_or_management:         ['control', 'managed', 'administered', 'controlled the asset'],
  litigation_guardian_role:            ['litigation guardian', 'next friend', 'case guardian', 'guardian ad litem'],
  personal_interest_in_litigation:     ['personally named', 'defendant', 'own interest', 'party to the proceedings'],
  procedural_conflict_of_interest:     ['conflict', 'adverse', 'cannot represent', 'disqualified from acting'],
  legal_representation_overlap:        ['same solicitor', 'same counsel', 'represented both', 'dual representation'],
  refusal_to_comply_with_request:      ['refused', 'failed to comply', 'did not respond', 'ignored', 'would not'],
  continuation_after_warning:          ['despite warning', 'after being notified', 'continued after', 'refused to step down', 'warned'],
  procedural_application:              ['application', 'motion', 'interlocutory', 'summons', 'hearing'],
  costs_dispute:                       ['costs', 'indemnity costs', 'party party costs', 'costs order', 'costs hearing'],
};
