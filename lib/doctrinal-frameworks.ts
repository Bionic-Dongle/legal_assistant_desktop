/**
 * lib/doctrinal-frameworks.ts
 *
 * Static doctrinal framework registry.
 * Defines legal elements, evidentiary prompts, and AustLII authority queries
 * for each recognised claim type.
 *
 * Static is intentional — legal doctrine is stable.
 * These templates guide the AI's reasoning, not replace it.
 *
 * Source: Legal Academy Case Law Research Assistant schema.
 */

export interface FrameworkElement {
  element_id:  string;
  label:       string;
  description: string;
  evidence_prompt: string;   // What to look for in evidence to satisfy this element
}

export interface DoctrinalFramework {
  framework_id:      string;
  claim:             string;
  jurisdiction:      string;
  category:          string;
  summary:           string;
  elements:          FrameworkElement[];
  authority_queries: string[];    // Pre-built AustLII search queries
  key_cases:         string[];    // Named authorities to always retrieve
}

export const DOCTRINAL_FRAMEWORK_REGISTRY: DoctrinalFramework[] = [
  {
    framework_id: 'constructive_trust_framework',
    claim:        'Constructive Trust',
    jurisdiction: 'Australia',
    category:     'Equity',
    summary:      'An equitable remedy imposing a trust over property where it would be unconscionable for the legal owner to deny a beneficial interest. Arises from common intention, contribution, and reliance.',
    elements: [
      {
        element_id:      'common_intention',
        label:           'Common Intention',
        description:     'The parties shared a common intention that the claimant would have a beneficial interest in the property.',
        evidence_prompt: 'Look for: verbal agreements, acknowledgements that the property was the claimant\'s, statements about ownership intentions, family arrangements, correspondence referring to "your property" or "your investment".',
      },
      {
        element_id:      'reliance',
        label:           'Reliance',
        description:     'The claimant relied on the common intention in a substantial way.',
        evidence_prompt: 'Look for: financial contributions made, management activities undertaken, renovation works performed — all done on the basis of an expectation of ownership.',
      },
      {
        element_id:      'detriment',
        label:           'Detriment',
        description:     'The claimant acted to their detriment in reliance on the common intention.',
        evidence_prompt: 'Look for: money spent, labour contributed, other opportunities foregone, financial sacrifice, long-term unpaid management.',
      },
      {
        element_id:      'unconscionability',
        label:           'Unconscionability',
        description:     'It would be unconscionable for the legal owner to deny the claimant\'s beneficial interest.',
        evidence_prompt: 'Look for: pattern of acknowledgement followed by denial, sale or dealing with property without consent, enrichment at claimant\'s expense.',
      },
    ],
    authority_queries: [
      'constructive trust property contributions Australia High Court',
      'common intention constructive trust Australia',
      'constructive trust family property arrangement Victoria',
    ],
    key_cases: [
      'Baumgartner v Baumgartner (1987) 164 CLR 137',
      'Muschinski v Dodds (1985) 160 CLR 583',
      'Bathurst City Council v PWC Properties Pty Ltd (1998) 195 CLR 566',
    ],
  },

  {
    framework_id: 'proprietary_estoppel_framework',
    claim:        'Proprietary Estoppel',
    jurisdiction: 'Australia',
    category:     'Equity',
    summary:      'An equitable doctrine preventing a party from denying a proprietary interest where a representation was made, relied upon, and detriment suffered — such that denial would be unconscionable.',
    elements: [
      {
        element_id:      'representation',
        label:           'Representation or Assurance',
        description:     'A clear representation or assurance was made regarding rights in property.',
        evidence_prompt: 'Look for: promises of ownership, statements the property would pass to the claimant, acknowledgements of entitlement, assurances made in correspondence or conversation.',
      },
      {
        element_id:      'reliance',
        label:           'Reliance',
        description:     'The claimant relied on the representation.',
        evidence_prompt: 'Look for: actions taken following the assurance — contributions, management, foregone alternatives, all attributable to the representation.',
      },
      {
        element_id:      'detriment',
        label:           'Detriment',
        description:     'The claimant suffered detriment in reliance on the representation.',
        evidence_prompt: 'Look for: financial expenditure, unpaid labour, opportunity cost, personal sacrifice — all suffered on the basis of the representation.',
      },
      {
        element_id:      'unconscionability',
        label:           'Unconscionability',
        description:     'It would be unconscionable for the defendant to depart from the assurance.',
        evidence_prompt: 'Look for: circumstances making denial of the interest particularly unjust — length of reliance, magnitude of detriment, defendant\'s knowledge of reliance.',
      },
    ],
    authority_queries: [
      'proprietary estoppel reliance detriment Australia',
      'proprietary estoppel property assurance High Court Australia',
      'estoppel equitable interest property Victoria',
    ],
    key_cases: [
      'Waltons Stores (Interstate) Ltd v Maher (1988) 164 CLR 387',
      'Commonwealth v Verwayen (1990) 170 CLR 394',
      'Giumelli v Giumelli (1999) 196 CLR 101',
    ],
  },

  {
    framework_id: 'fiduciary_duty_framework',
    claim:        'Breach of Fiduciary Duty',
    jurisdiction: 'Australia',
    category:     'Equity',
    summary:      'A fiduciary must act in the best interests of the principal, avoiding conflicts and unauthorised profits. Breach occurs when the fiduciary acts for their own benefit or in conflict with the principal\'s interests.',
    elements: [
      {
        element_id:      'fiduciary_relationship',
        label:           'Existence of Fiduciary Relationship',
        description:     'A fiduciary relationship existed between the parties.',
        evidence_prompt: 'Look for: POA documents, trust instruments, evidence of dependence and vulnerability, undertakings to act on another\'s behalf.',
      },
      {
        element_id:      'duty_owed',
        label:           'Duty Owed',
        description:     'The fiduciary owed duties of loyalty, good faith, and to avoid conflicts of interest.',
        evidence_prompt: 'Look for: the scope of the fiduciary appointment, any express obligations, statutory duties (e.g. Powers of Attorney Act 2014 (Vic)).',
      },
      {
        element_id:      'breach',
        label:           'Breach of Duty',
        description:     'The fiduciary acted contrary to the duty — typically by placing their own interest above the principal\'s.',
        evidence_prompt: 'Look for: transactions that benefit the fiduciary, actions taken without the principal\'s knowledge or consent, self-dealing.',
      },
      {
        element_id:      'loss_or_gain',
        label:           'Loss or Equitable Consequence',
        description:     'The principal suffered loss or the fiduciary obtained an unauthorised gain.',
        evidence_prompt: 'Look for: property transferred, proceeds received, financial benefit obtained, loss suffered by the principal.',
      },
    ],
    authority_queries: [
      'breach fiduciary duty power of attorney Australia',
      'fiduciary duties attorney Australia case law',
      'POA breach duty Victoria Supreme Court',
    ],
    key_cases: [
      'Hospital Products Ltd v United States Surgical Corp (1984) 156 CLR 41',
      'Maguire v Makaronis (1997) 188 CLR 449',
      'Powers of Attorney Act 2014 (Vic) s 66',
    ],
  },

  {
    framework_id: 'barnes_v_addy_framework',
    claim:        'Accessory Liability for Breach of Trust (Barnes v Addy)',
    jurisdiction: 'Australia',
    category:     'Equity',
    summary:      'Third-party liability arises either from knowing receipt of trust property, or knowing assistance in a breach of fiduciary duty. The Baden scale categorises the degree of knowledge required.',
    elements: [
      {
        element_id:      'primary_breach',
        label:           'Primary Breach of Trust or Fiduciary Duty',
        description:     'A breach of trust or fiduciary duty by the primary wrongdoer must be established.',
        evidence_prompt: 'Look for: established or alleged breach by the primary fiduciary — sale of trust property, misapplication of funds, unauthorised transaction.',
      },
      {
        element_id:      'third_party_participation',
        label:           'Third-Party Participation',
        description:     'The third party induced, assisted, or received property in connection with the breach.',
        evidence_prompt: 'Look for: third party receiving proceeds, assisting in transaction, facilitating transfer, participating in the dealing.',
      },
      {
        element_id:      'knowledge',
        label:           'Knowledge (Baden Categories)',
        description:     'The third party had knowledge of the breach — actual knowledge, wilful blindness, or reckless disregard is sufficient. Mere suspicion may suffice in some categories.',
        evidence_prompt: 'Look for: correspondence showing awareness, communications between parties, warnings received, circumstantial evidence of knowledge of the breach or trust relationship.',
      },
    ],
    authority_queries: [
      'Barnes v Addy accessory liability Australia',
      'knowing procurement breach of trust Baden knowledge Australia',
      'Farah Constructions Say-Dee accessory liability Australia',
    ],
    key_cases: [
      'Barnes v Addy (1874) LR 9 Ch App 244',
      'Farah Constructions Pty Ltd v Say-Dee Pty Ltd (2007) 230 CLR 89',
      'Pittmore Pty Ltd v Chan [2020] NSWSC 272',
    ],
  },

  {
    framework_id: 'litigation_guardian_framework',
    claim:        'Litigation Guardian — Conflict of Interest',
    jurisdiction: 'Australia',
    category:     'Procedural',
    summary:      'A litigation guardian must act solely in the best interests of the represented party. A disqualifying conflict arises where the guardian has a personal interest adverse to the represented person.',
    elements: [
      {
        element_id:      'guardian_appointment',
        label:           'Appointment as Litigation Guardian',
        description:     'The person was appointed as litigation guardian.',
        evidence_prompt: 'Look for: court orders appointing guardian, litigation guardian certificate filed with court.',
      },
      {
        element_id:      'conflict_existence',
        label:           'Existence of Conflict',
        description:     'A conflict existed between the guardian\'s personal interests and their duty to the represented person.',
        evidence_prompt: 'Look for: guardian personally named as defendant or claimant, financial interest in outcome, adversarial relationship with the represented person.',
      },
      {
        element_id:      'duty_breach',
        label:           'Breach of Guardian\'s Duty',
        description:     'The guardian acted contrary to their duty or failed to act in the represented person\'s best interests.',
        evidence_prompt: 'Look for: litigation steps benefiting guardian personally, failure to accept reasonable offers, inaccurate certificates filed with the court.',
      },
      {
        element_id:      'refusal_to_withdraw',
        label:           'Refusal to Withdraw Despite Warning',
        description:     'The guardian refused to step down after the conflict was identified.',
        evidence_prompt: 'Look for: correspondence requesting resignation, court flag of conflict, continued resistance after notification.',
      },
    ],
    authority_queries: [
      'litigation guardian conflict of interest removal Victoria',
      'next friend removal conflict of interest Australia',
      'Supreme Court Rules litigation guardian Victoria',
    ],
    key_cases: [
      'Supreme Court (General Civil Procedure) Rules 2025 (Vic) r 15.03',
      'Reid v Reid [2025] VSC 566',
    ],
  },

  {
    framework_id: 'poa_duty_framework',
    claim:        'Power of Attorney — Breach of Duty',
    jurisdiction: 'Australia',
    category:     'Equity',
    summary:      'An attorney under an Enduring Power of Attorney must act honestly, in good faith, and in the best interests of the principal. Breach occurs when the attorney acts for personal benefit or contrary to the principal\'s interests.',
    elements: [
      {
        element_id:      'poa_existence',
        label:           'Enduring Power of Attorney',
        description:     'A valid Enduring Power of Attorney was in place.',
        evidence_prompt: 'Look for: the POA document, registration or execution details, scope of the power granted.',
      },
      {
        element_id:      'attorney_duty',
        label:           'Duty to Act in Principal\'s Interests',
        description:     'The attorney was obliged to act in the principal\'s best interests under the Powers of Attorney Act 2014 (Vic).',
        evidence_prompt: 'Look for: the statutory duties, any express conditions in the POA document.',
      },
      {
        element_id:      'breach_of_poa_duty',
        label:           'Breach',
        description:     'The attorney acted contrary to the principal\'s interests or for their own benefit.',
        evidence_prompt: 'Look for: sale of property without informed consent, refinancing benefiting the attorney, exclusion of the principal from decisions, misapplication of proceeds.',
      },
      {
        element_id:      'principal_loss',
        label:           'Loss to Principal',
        description:     'The principal suffered loss as a result of the attorney\'s conduct.',
        evidence_prompt: 'Look for: property disposed of, proceeds not applied for the principal\'s benefit, financial detriment to the principal.',
      },
    ],
    authority_queries: [
      'powers of attorney breach duty Victoria',
      'enduring power of attorney misuse property Australia',
      'attorney duty best interest principal Victoria',
    ],
    key_cases: [
      'Powers of Attorney Act 2014 (Vic)',
      'Guardianship and Administration Act 2019 (Vic)',
      'Re B [2012] VSC 300',
    ],
  },

  {
    framework_id: 'costs_order_framework',
    claim:        'Personal Costs Order',
    jurisdiction: 'Australia',
    category:     'Costs',
    summary:      'Courts may order a party — including a litigation guardian — to pay costs personally where their conduct unreasonably prolonged or necessitated litigation.',
    elements: [
      {
        element_id:      'costs_event',
        label:           'Relevant Costs Event',
        description:     'An application or hearing resulted in a costs determination.',
        evidence_prompt: 'Look for: the outcome of applications, orders made, hearing results.',
      },
      {
        element_id:      'unreasonable_conduct',
        label:           'Unreasonable Conduct',
        description:     'The party acted unreasonably — persisting in a position that had been identified as untenable.',
        evidence_prompt: 'Look for: correspondence asking party to step down or settle, court notices of concern, party continuing despite clear warnings.',
      },
      {
        element_id:      'warnings_given',
        label:           'Warnings Given and Ignored',
        description:     'Formal warnings or invitations to avoid litigation were given and ignored.',
        evidence_prompt: 'Look for: letters of demand, invitations to consent, court observations, repeated requests to step down.',
      },
      {
        element_id:      'increased_costs',
        label:           'Costs Increased by Conduct',
        description:     'The party\'s conduct materially increased the costs incurred.',
        evidence_prompt: 'Look for: costs incurred on the removal or contested application, costs that could have been avoided if warnings heeded.',
      },
    ],
    authority_queries: [
      'personal costs order litigation guardian Victoria',
      'costs order unreasonable conduct civil proceedings Australia',
      'indemnity costs order refused to step down Australia',
    ],
    key_cases: [
      'Oshlack v Richmond River Council (1998) 193 CLR 72',
      'Uniform Civil Procedure Rules costs discretion',
      'Civil Procedure Act 2010 (Vic) s 24',
    ],
  },
];

/** Fast lookup by framework_id */
export function getFramework(frameworkId: string): DoctrinalFramework | undefined {
  return DOCTRINAL_FRAMEWORK_REGISTRY.find(f => f.framework_id === frameworkId);
}

/** Get all frameworks for a list of detected claim framework IDs */
export function getFrameworksForClaims(frameworkIds: string[]): DoctrinalFramework[] {
  const ids = new Set(frameworkIds);
  return DOCTRINAL_FRAMEWORK_REGISTRY.filter(f => ids.has(f.framework_id));
}

/**
 * Build a concise context block for injection into the LLM prompt.
 * Summarises activated frameworks + their elements.
 */
export function buildFrameworkContext(frameworks: DoctrinalFramework[]): string {
  if (frameworks.length === 0) return '';

  const lines: string[] = ['## Applicable Legal Frameworks\n'];

  for (const fw of frameworks) {
    lines.push(`### ${fw.claim}`);
    lines.push(fw.summary);
    lines.push('\nElements to establish:');
    for (const el of fw.elements) {
      lines.push(`- **${el.label}**: ${el.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
