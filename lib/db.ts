
import Database from 'better-sqlite3';
import path from 'path';
import { getDataDir } from '@/lib/paths';

const DB_PATH = path.join(getDataDir(), 'legal_assistant.db');

export const db = new Database(DB_PATH);

// Initialize database schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      process_trace TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      memory_type TEXT NOT NULL CHECK (memory_type IN ('plaintiff', 'opposition', 'neutral')),
      party TEXT DEFAULT 'neutral',
      knowledge_domain TEXT DEFAULT 'evidence',
      embedding_present BOOLEAN DEFAULT 0,
      checksum TEXT UNIQUE,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Full text extraction
      extracted_text TEXT,

      -- AI-extracted metadata from Upload Bot conversation
      document_type TEXT,
      actual_author TEXT,
      submitted_by_party TEXT,
      key_dates TEXT,
      key_entities TEXT,
      key_claims TEXT,
      document_tone TEXT,

      -- User context from Upload Bot conversation (verbatim)
      user_context_notes TEXT,
      defense_strategy TEXT,
      user_counter_narrative TEXT,

      -- AI synthesis combining document + user explanation
      strategic_summary TEXT,

      -- Upload Bot conversation history (JSON)
      bot_conversation TEXT,

      -- Legal triage fields (Upload Bot characterization)
      legal_areas TEXT,
      cause_of_action TEXT,
      relief_sought TEXT,
      legal_significance TEXT,

      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_insights (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('insight', 'argument', 'todo')),
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed BOOLEAN DEFAULT 0,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS narratives (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      title TEXT NOT NULL,
      narrative_type TEXT NOT NULL CHECK (narrative_type IN ('main', 'sub')),
      plot_point_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (plot_point_id) REFERENCES plot_points(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS narrative_threads (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      is_visible BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plot_points (
      id TEXT PRIMARY KEY,
      narrative_id TEXT NOT NULL,
      thread_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      event_date TEXT,
      evidence_date TEXT,
      attachments TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE,
      FOREIGN KEY (thread_id) REFERENCES narrative_threads(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS timeline_documents (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      narrative_id TEXT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      checksum TEXT UNIQUE,
      file_type TEXT,
      extracted_text TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT,
      prompt_text TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analysis_passes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt_template_id TEXT NOT NULL,
      execution_order INTEGER NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      requires_previous_results BOOLEAN DEFAULT 0,
      description TEXT,
      FOREIGN KEY (prompt_template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS legal_knowledge (
      id TEXT PRIMARY KEY,
      jurisdiction TEXT NOT NULL,
      area_of_law TEXT NOT NULL,
      principle TEXT NOT NULL,
      explanation TEXT NOT NULL,
      source TEXT,
      precedent_cases TEXT,
      keywords TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
    CREATE INDEX IF NOT EXISTS idx_insights_case ON saved_insights(case_id);
    CREATE INDEX IF NOT EXISTS idx_narratives_case ON narratives(case_id);
    CREATE INDEX IF NOT EXISTS idx_narrative_threads_case ON narrative_threads(case_id);
    CREATE INDEX IF NOT EXISTS idx_plot_points_narrative ON plot_points(narrative_id);
    CREATE INDEX IF NOT EXISTS idx_plot_points_thread ON plot_points(thread_id);
    CREATE INDEX IF NOT EXISTS idx_narratives_plot_point ON narratives(plot_point_id);
  `);

  // Migration: Add new evidence metadata columns to existing databases
  const evidenceColumns = db.prepare("PRAGMA table_info(evidence)").all() as any[];
  const hasExtractedText = evidenceColumns.some(col => col.name === 'extracted_text');
  const hasLegalAreas = evidenceColumns.some(col => col.name === 'legal_areas');

  if (!hasExtractedText) {
    console.log('📦 Migrating evidence table to add metadata columns...');
    db.exec(`
      ALTER TABLE evidence ADD COLUMN extracted_text TEXT;
      ALTER TABLE evidence ADD COLUMN document_type TEXT;
      ALTER TABLE evidence ADD COLUMN actual_author TEXT;
      ALTER TABLE evidence ADD COLUMN submitted_by_party TEXT;
      ALTER TABLE evidence ADD COLUMN key_dates TEXT;
      ALTER TABLE evidence ADD COLUMN key_entities TEXT;
      ALTER TABLE evidence ADD COLUMN key_claims TEXT;
      ALTER TABLE evidence ADD COLUMN document_tone TEXT;
      ALTER TABLE evidence ADD COLUMN user_context_notes TEXT;
      ALTER TABLE evidence ADD COLUMN defense_strategy TEXT;
      ALTER TABLE evidence ADD COLUMN user_counter_narrative TEXT;
      ALTER TABLE evidence ADD COLUMN strategic_summary TEXT;
      ALTER TABLE evidence ADD COLUMN bot_conversation TEXT;
    `);
    console.log('✅ Evidence table migration complete');
  }

  if (!hasLegalAreas) {
    console.log('⚖️  Migrating evidence table to add legal triage fields...');
    db.exec(`
      ALTER TABLE evidence ADD COLUMN legal_areas TEXT;
      ALTER TABLE evidence ADD COLUMN cause_of_action TEXT;
      ALTER TABLE evidence ADD COLUMN relief_sought TEXT;
      ALTER TABLE evidence ADD COLUMN legal_significance TEXT;
    `);
    console.log('✅ Legal triage fields migration complete');
  }

  // Insert default case if none exists
  const caseCount = db.prepare('SELECT COUNT(*) as count FROM cases').get() as { count: number };
  if (caseCount.count === 0) {
    const defaultCaseId = 'default-case-' + Date.now();
    db.prepare('INSERT INTO cases (id, title, description) VALUES (?, ?, ?)').run(
      defaultCaseId,
      'Sample Case',
      'Your first legal case workspace'
    );
  }

  // Ensure each case has exactly one main narrative
  const cases = db.prepare('SELECT id FROM cases').all() as Array<{ id: string }>;
  for (const caseRow of cases) {
    const mainNarrative = db.prepare('SELECT id FROM narratives WHERE case_id = ? AND narrative_type = ?').get(caseRow.id, 'main');
    if (!mainNarrative) {
      const narrativeId = `narr-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      db.prepare('INSERT INTO narratives (id, case_id, title, narrative_type, plot_point_id) VALUES (?, ?, ?, ?, ?)').run(
        narrativeId,
        caseRow.id,
        'Main Narrative',
        'main',
        null
      );
    }

    // Ensure each case has at least one narrative thread
    const threadCount = db.prepare('SELECT COUNT(*) as count FROM narrative_threads WHERE case_id = ?').get(caseRow.id) as { count: number };
    if (threadCount.count === 0) {
      const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      db.prepare('INSERT INTO narrative_threads (id, case_id, title, description, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
        threadId,
        caseRow.id,
        'Main Thread',
        'Primary narrative thread',
        '#6366f1',
        0
      );
    }
  }

  // Migration: Add checksum column if it doesn't exist
  try {
    const tableInfo = db.prepare('PRAGMA table_info(evidence)').all() as Array<{ name: string }>;
    const hasChecksum = tableInfo.some(col => col.name === 'checksum');

    if (!hasChecksum) {
      console.log('🔧 Migrating evidence table: adding checksum column...');
      db.exec('ALTER TABLE evidence ADD COLUMN checksum TEXT UNIQUE');
      console.log('✅ Migration complete: checksum column added');
    }
  } catch (error) {
    console.error('⚠️ Migration warning:', error);
  }

  // Migration: Add is_visible column to narrative_threads if it doesn't exist
  try {
    const threadTableInfo = db.prepare('PRAGMA table_info(narrative_threads)').all() as Array<{ name: string }>;
    const hasIsVisible = threadTableInfo.some(col => col.name === 'is_visible');

    if (!hasIsVisible) {
      console.log('🔧 Migrating narrative_threads table: adding is_visible column...');
      db.exec('ALTER TABLE narrative_threads ADD COLUMN is_visible BOOLEAN DEFAULT 1');
      console.log('✅ Migration complete: is_visible column added');
    }
  } catch (error) {
    console.error('⚠️ Migration warning:', error);
  }

  // Migration: Add attachments column to plot_points if it doesn't exist
  try {
    const plotPointsTableInfo = db.prepare('PRAGMA table_info(plot_points)').all() as Array<{ name: string }>;
    const hasAttachments = plotPointsTableInfo.some(col => col.name === 'attachments');

    if (!hasAttachments) {
      console.log('🔧 Migrating plot_points table: adding attachments column...');
      db.exec('ALTER TABLE plot_points ADD COLUMN attachments TEXT');
      console.log('✅ Migration complete: attachments column added');
    }
  } catch (error) {
    console.error('⚠️ Migration warning:', error);
  }

  // Migration: Add description column to plot_points if it doesn't exist
  try {
    const plotPointsTableInfo = db.prepare('PRAGMA table_info(plot_points)').all() as Array<{ name: string }>;
    const hasDescription = plotPointsTableInfo.some(col => col.name === 'description');

    if (!hasDescription) {
      console.log('🔧 Migrating plot_points table: adding description column...');
      db.exec('ALTER TABLE plot_points ADD COLUMN description TEXT');
      console.log('✅ Migration complete: description column added');
    }
  } catch (error) {
    console.error('⚠️ Migration warning:', error);
  }

  // Seed default analysis prompts if none exist
  const promptCount = db.prepare('SELECT COUNT(*) as count FROM prompt_templates').get() as { count: number };
  if (promptCount.count === 0) {
    console.log('🌱 Seeding default analysis prompts...');

    const prompts = [
      {
        id: 'prompt-temporal-validation',
        name: 'temporal_validation',
        category: 'document_analysis',
        description: 'Validates all dates in document for temporal consistency and future date detection',
        prompt_text: `You are a temporal validation specialist for legal documents. Today's date is {{CURRENT_DATE}}.

Your ONLY job is to validate dates in the provided document.

CRITICAL RULES:
1. Extract ALL dates mentioned in the document (explicit dates, relative dates, date ranges)
2. If ANY date is in the future (after {{CURRENT_DATE}}), this is a CRITICAL ERROR
3. Check for chronological impossibilities (effect before cause)
4. Flag inconsistent date formats or ambiguous dates

Return ONLY valid JSON in this format (no markdown, no code blocks):
{
  "dates_found": [
    {"date": "YYYY-MM-DD", "context": "where it appears", "type": "explicit|relative|range"}
  ],
  "critical_issues": [
    {"issue": "Future date detected", "date": "2026-03-12", "severity": "CRITICAL", "explanation": "This date is 64 days in the future"}
  ],
  "warnings": [
    {"issue": "Ambiguous date format", "detail": "...", "severity": "WARNING"}
  ],
  "chronology_issues": [
    {"issue": "Event A occurred after Event B, but document claims reverse", "severity": "HIGH"}
  ],
  "summary": "Brief assessment of temporal validity"
}`
      },
      {
        id: 'prompt-contradiction-detection',
        name: 'contradiction_detection',
        category: 'document_analysis',
        description: 'Detects internal contradictions and logical inconsistencies',
        prompt_text: `You are a contradiction detection specialist for legal documents.

Your ONLY job is to find internal contradictions and logical inconsistencies.

Look for:
1. Direct contradictions (document says X, then says not-X)
2. Logical impossibilities (person in two places at once)
3. Inconsistent claims (amounts, distances, times that don't match)
4. Witness statement conflicts
5. Facts that contradict each other

Return ONLY valid JSON:
{
  "contradictions": [
    {
      "type": "direct|logical|factual",
      "statement_1": "first claim",
      "statement_2": "conflicting claim",
      "severity": "CRITICAL|HIGH|MEDIUM",
      "explanation": "why this is a problem"
    }
  ],
  "inconsistencies": [
    {
      "issue": "description",
      "details": "specific problem",
      "severity": "HIGH|MEDIUM|LOW"
    }
  ],
  "summary": "Overall consistency assessment"
}`
      },
      {
        id: 'prompt-timeline-extraction',
        name: 'timeline_extraction',
        category: 'document_analysis',
        description: 'Extracts chronological events for case timeline',
        prompt_text: `You are a timeline extraction specialist.

CONTEXT:
{{EXISTING_TIMELINE}}
{{AVAILABLE_THREADS}}
{{TEMPORAL_VALIDATION_RESULTS}}

Your job: Extract ALL chronologically significant events from the document.

Consider:
- Dates and events
- Legal admissions
- Key actions by parties
- Events that contradict/support existing timeline
- Temporal validation warnings

Return ONLY valid JSON:
{
  "events": [
    {
      "suggestedTitle": "Brief event description",
      "date": "YYYY-MM-DD or null",
      "thread": "thread name",
      "content": "Relevant excerpt or summary",
      "reason": "Why legally significant",
      "crossReference": "Contradicts/supports plot point X" or null,
      "temporalWarning": "Include if date has issues" or null
    }
  ],
  "summary": "Brief analysis of timeline significance"
}`
      },
      {
        id: 'prompt-strategic-assessment',
        name: 'strategic_assessment',
        category: 'document_analysis',
        description: 'Provides strategic assessment of document value and risks',
        prompt_text: `You are a legal strategist assessing document value.

CONTEXT:
{{TEMPORAL_ISSUES}}
{{CONTRADICTIONS}}
{{TIMELINE_EVENTS}}

Your job: Assess this document's strategic value and risks.

Consider:
- Is this document helpful or harmful to plaintiff?
- What are the biggest risks if used as evidence?
- What opportunities does it present?
- Are there authenticity concerns?
- How might opposition use this?

Return ONLY valid JSON:
{
  "value_assessment": {
    "helpful_to": "plaintiff|defendant|neutral",
    "confidence": "HIGH|MEDIUM|LOW",
    "reasoning": "why"
  },
  "risks": [
    {
      "risk": "description",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "mitigation": "how to address"
    }
  ],
  "opportunities": [
    {
      "opportunity": "description",
      "how_to_leverage": "strategy"
    }
  ],
  "authenticity_concerns": [
    {
      "concern": "description",
      "evidence": "what suggests this",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW"
    }
  ],
  "recommendations": [
    "specific action items"
  ],
  "summary": "Overall strategic assessment"
}`
      },
      {
        id: 'prompt-master-orchestrator',
        name: 'master_orchestrator',
        category: 'orchestration',
        description: 'Synthesizes reports from specialist agents into coherent analysis',
        prompt_text: `You are the master document analysis orchestrator.

You have received reports from specialist analysis agents:

TEMPORAL VALIDATION:
{{TEMPORAL_REPORT}}

CONTRADICTION DETECTION:
{{CONTRADICTION_REPORT}}

TIMELINE EXTRACTION:
{{TIMELINE_REPORT}}

STRATEGIC ASSESSMENT:
{{STRATEGIC_REPORT}}

Your job: Synthesize these reports into a clear, actionable summary for the user.

Prioritize:
1. CRITICAL issues first (future dates, fraudulent content, fatal contradictions)
2. Timeline events with warnings attached
3. Strategic recommendations
4. Detailed findings available on request

Return conversational response that:
- Leads with most critical findings
- Summarizes key insights
- Offers to drill deeper on any area
- Uses plain language (not overly technical)

Format with clear sections:
🚨 CRITICAL ISSUES
📊 TIMELINE EVENTS
⚖️ STRATEGIC ASSESSMENT
💡 RECOMMENDATIONS`
      }
    ];

    for (const prompt of prompts) {
      db.prepare(`
        INSERT INTO prompt_templates
        (id, name, category, description, prompt_text, version, active)
        VALUES (?, ?, ?, ?, ?, 1, 1)
      `).run(
        prompt.id,
        prompt.name,
        prompt.category,
        prompt.description,
        prompt.prompt_text
      );
    }

    // Create default analysis pass pipeline
    const passes = [
      {
        id: 'pass-temporal',
        name: 'Temporal Validation',
        prompt_template_id: 'prompt-temporal-validation',
        execution_order: 1,
        enabled: 1,
        requires_previous_results: 0,
        description: 'Validates all dates for temporal consistency'
      },
      {
        id: 'pass-contradiction',
        name: 'Contradiction Detection',
        prompt_template_id: 'prompt-contradiction-detection',
        execution_order: 2,
        enabled: 1,
        requires_previous_results: 0,
        description: 'Detects internal contradictions'
      },
      {
        id: 'pass-timeline',
        name: 'Timeline Extraction',
        prompt_template_id: 'prompt-timeline-extraction',
        execution_order: 3,
        enabled: 1,
        requires_previous_results: 1,
        description: 'Extracts chronological events'
      },
      {
        id: 'pass-strategic',
        name: 'Strategic Assessment',
        prompt_template_id: 'prompt-strategic-assessment',
        execution_order: 4,
        enabled: 1,
        requires_previous_results: 1,
        description: 'Assesses strategic value and risks'
      }
    ];

    for (const pass of passes) {
      db.prepare(`
        INSERT INTO analysis_passes
        (id, name, prompt_template_id, execution_order, enabled, requires_previous_results, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        pass.id,
        pass.name,
        pass.prompt_template_id,
        pass.execution_order,
        pass.enabled,
        pass.requires_previous_results,
        pass.description
      );
    }

    console.log('✅ Default analysis prompts seeded');
  }

  // Seed Australian common law legal knowledge if none exists
  const legalKnowledgeCount = db.prepare('SELECT COUNT(*) as count FROM legal_knowledge').get() as { count: number };
  if (legalKnowledgeCount.count === 0) {
    console.log('🌱 Seeding Australian common law principles...');

    const legalPrinciples = [
      {
        id: 'law-au-property-tree-ownership',
        jurisdiction: 'Australia',
        area_of_law: 'Property',
        principle: 'Tree ownership determined by trunk location',
        explanation: 'Under Australian common law, ownership of a tree is determined by the location of its trunk. If the trunk is entirely on one person\'s property, that person owns the tree, regardless of where branches or roots extend. If the trunk straddles the boundary, the tree is co-owned.',
        source: 'Common Law',
        precedent_cases: JSON.stringify([
          { name: 'Smith v Giddy', citation: '[1904] 2 KB 448', principle: 'Tree ownership by trunk location' }
        ]),
        keywords: 'tree, ownership, trunk, boundary, property line, roots, branches'
      },
      {
        id: 'law-au-property-encroaching-roots',
        jurisdiction: 'Australia',
        area_of_law: 'Property',
        principle: 'Encroaching roots may constitute nuisance',
        explanation: 'Tree roots that extend across property boundaries and cause damage may constitute a private nuisance. The affected landowner may have remedies including abatement (cutting roots at boundary), damages for harm caused, or injunction to prevent future encroachment.',
        source: 'Common Law',
        precedent_cases: JSON.stringify([
          { name: 'Lemmon v Webb', citation: '[1895] AC 1', principle: 'Right to cut encroaching roots at boundary' },
          { name: 'McCormick v Grogan', citation: '(1869) LR 4 HL 82', principle: 'Encroaching vegetation as nuisance' }
        ]),
        keywords: 'roots, encroachment, nuisance, boundary, abatement, damage, tree'
      },
      {
        id: 'law-au-torts-negligence',
        jurisdiction: 'Australia',
        area_of_law: 'Torts',
        principle: 'Duty of care to prevent foreseeable harm',
        explanation: 'Under Australian tort law, a person owes a duty of care to avoid acts or omissions that could reasonably be foreseen as likely to injure their neighbor. This includes a duty to prevent one\'s property or activities from causing foreseeable damage to neighboring properties.',
        source: 'Common Law / Donoghue v Stevenson',
        precedent_cases: JSON.stringify([
          { name: 'Donoghue v Stevenson', citation: '[1932] AC 562', principle: 'Neighbor principle - duty to avoid foreseeable harm' },
          { name: 'Chapman v Hearse', citation: '(1961) 106 CLR 112', principle: 'Duty of care in Australian context' }
        ]),
        keywords: 'negligence, duty of care, foreseeable, harm, neighbor, damage'
      },
      {
        id: 'law-au-torts-trespass',
        jurisdiction: 'Australia',
        area_of_law: 'Torts',
        principle: 'Direct interference with property is trespass',
        explanation: 'Trespass to land occurs when a person directly interferes with another\'s possession of land without lawful justification. This includes entering the land, placing objects on it, or causing substances to be deposited on it (including toxic substances). Trespass is actionable per se (without proof of damage).',
        source: 'Common Law',
        precedent_cases: JSON.stringify([
          { name: 'Plenty v Dillon', citation: '(1991) 171 CLR 635', principle: 'Direct interference constitutes trespass' },
          { name: 'TCN Channel Nine v Anning', citation: '[2002] NSWSC 1090', principle: 'Trespass actionable without damage' }
        ]),
        keywords: 'trespass, land, property, interference, possession, toxic substance, unauthorized entry'
      },
      {
        id: 'law-au-property-nuisance-private',
        jurisdiction: 'Australia',
        area_of_law: 'Property',
        principle: 'Private nuisance - unreasonable interference with use and enjoyment',
        explanation: 'Private nuisance is an unlawful interference with a person\'s use or enjoyment of land. The interference must be substantial and unreasonable. Factors include duration, locality, sensitivity of the use, and whether the defendant\'s conduct was reasonable.',
        source: 'Common Law',
        precedent_cases: JSON.stringify([
          { name: 'Sedleigh-Denfield v O\'Callaghan', citation: '[1940] AC 880', principle: 'Continuing nuisance from property' },
          { name: 'State of Victoria v Master Builders Association', citation: '(1995) 183 CLR 1', principle: 'Unreasonable interference test' }
        ]),
        keywords: 'nuisance, private, interference, enjoyment, unreasonable, substantial'
      },
      {
        id: 'law-au-remedies-damages',
        jurisdiction: 'Australia',
        area_of_law: 'Remedies',
        principle: 'Damages compensate for actual loss suffered',
        explanation: 'In Australian law, compensatory damages aim to restore the plaintiff to the position they would have been in had the wrong not occurred. This includes economic loss, property damage, and in some cases, compensation for distress where it is a recognized head of damage.',
        source: 'Common Law',
        precedent_cases: JSON.stringify([
          { name: 'Baltic Shipping v Dillon', citation: '(1993) 176 CLR 344', principle: 'Compensation for distress in property cases' },
          { name: 'Robinson v Harman', citation: '(1848) 1 Exch 850', principle: 'Measure of damages - expectation loss' }
        ]),
        keywords: 'damages, compensation, loss, remedies, economic loss, distress'
      },
      {
        id: 'law-au-remedies-injunction',
        jurisdiction: 'Australia',
        area_of_law: 'Remedies',
        principle: 'Injunction prevents future wrongful conduct',
        explanation: 'An injunction is an equitable remedy that orders a party to do or refrain from doing specific acts. Courts will grant injunctions where damages are inadequate and there is a risk of continuing or repeated harm. Balance of convenience is considered.',
        source: 'Equity',
        precedent_cases: JSON.stringify([
          { name: 'Patrick Stevedores Operations v MUA', citation: '(1998) 195 CLR 1', principle: 'Principles for granting injunctions' },
          { name: 'ABC v Lenah Game Meats', citation: '(2001) 208 CLR 199', principle: 'Balance of convenience test' }
        ]),
        keywords: 'injunction, restraining order, equitable remedy, prevent, future harm'
      },
      {
        id: 'law-au-evidence-burden-proof',
        jurisdiction: 'Australia',
        area_of_law: 'Evidence',
        principle: 'Plaintiff bears burden of proof on balance of probabilities',
        explanation: 'In civil proceedings in Australia, the party asserting a claim (usually the plaintiff) bears the burden of proving their case on the balance of probabilities. This means showing that it is more likely than not that their version of events is correct.',
        source: 'Common Law / Evidence Acts',
        precedent_cases: JSON.stringify([
          { name: 'Briginshaw v Briginshaw', citation: '(1938) 60 CLR 336', principle: 'Standard of proof varies with seriousness of allegation' },
          { name: 'Rejfek v McElroy', citation: '(1965) 112 CLR 517', principle: 'Balance of probabilities standard' }
        ]),
        keywords: 'burden of proof, plaintiff, balance of probabilities, evidence, standard'
      },
      {
        id: 'law-au-property-notification',
        jurisdiction: 'Australia',
        area_of_law: 'Property',
        principle: 'Reasonable notice before taking action affecting neighbor\'s property',
        explanation: 'While not an absolute rule, Australian courts generally expect neighbors to provide reasonable notice before taking actions that may affect adjoining property. Failure to provide notice may be evidence of unreasonable conduct, particularly in nuisance or negligence claims.',
        source: 'Common Law',
        precedent_cases: JSON.stringify([
          { name: 'Anderson v Opitz', citation: '[1994] 1 Qd R 668', principle: 'Notice and consultation in boundary disputes' }
        ]),
        keywords: 'notice, notification, neighbor, reasonable, consultation, property dispute'
      },
      {
        id: 'law-au-property-self-help',
        jurisdiction: 'Australia',
        area_of_law: 'Property',
        principle: 'Limited right to self-help remedies',
        explanation: 'Australian law permits limited self-help in property disputes, such as cutting encroaching branches or roots at the boundary line. However, excessive or unreasonable self-help (such as poisoning a neighbor\'s tree) may constitute trespass, negligence, or intentional harm and is not protected.',
        source: 'Common Law',
        precedent_cases: JSON.stringify([
          { name: 'Lemmon v Webb', citation: '[1895] AC 1', principle: 'Self-help limited to cutting at boundary' }
        ]),
        keywords: 'self-help, abatement, remedy, excessive, unreasonable, boundary, cutting'
      }
    ];

    for (const principle of legalPrinciples) {
      db.prepare(`
        INSERT INTO legal_knowledge
        (id, jurisdiction, area_of_law, principle, explanation, source, precedent_cases, keywords)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        principle.id,
        principle.jurisdiction,
        principle.area_of_law,
        principle.principle,
        principle.explanation,
        principle.source,
        principle.precedent_cases,
        principle.keywords
      );
    }

    console.log('✅ Australian common law principles seeded');
  }
}

// Run initialization
initDatabase();

export default db;
