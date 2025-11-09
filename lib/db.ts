
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'data')
  : path.join(process.cwd(), 'data');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'legal_assistant.db');

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
      memory_type TEXT NOT NULL CHECK (memory_type IN ('plaintiff', 'opposition')),
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

    CREATE TABLE IF NOT EXISTS plot_points (
      id TEXT PRIMARY KEY,
      narrative_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (narrative_id) REFERENCES narratives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
    CREATE INDEX IF NOT EXISTS idx_insights_case ON saved_insights(case_id);
    CREATE INDEX IF NOT EXISTS idx_narratives_case ON narratives(case_id);
    CREATE INDEX IF NOT EXISTS idx_plot_points_narrative ON plot_points(narrative_id);
    CREATE INDEX IF NOT EXISTS idx_narratives_plot_point ON narratives(plot_point_id);
  `);

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
  }
}

// Run initialization
initDatabase();

export default db;
