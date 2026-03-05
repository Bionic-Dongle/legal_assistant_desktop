# LegalMind Desktop — Roadmap

> **Current status**: Personal-use MVP. Core systems are working. Focus now shifts to loading real evidence, using the app in anger, and fixing issues as they surface.

---

## ✅ Completed

### Core Infrastructure
- Electron 28 + Next.js 14 App Router desktop app
- SQLite database (better-sqlite3) with full schema and migrations
- JSON-based vector storage (keyword fallback + OpenAI embedding support)
- Dynamic OpenAI API key sync (UI → .env → runtime, no restart required)
- Local-first: all data stays on machine, no cloud dependencies

### Evidence System (RAG Core)
- Drag-and-drop evidence upload (plaintiff / opposition / neutral)
- SHA-256 dedup — rejects duplicate uploads silently
- Text extraction + OpenAI `text-embedding-3-small` embedding generation
- Vector store insert (`{memoryType}_{caseId}` collections)
- Evidence context assembly injected into every chat request
- Upload Bot: AI-guided triage fills document metadata on upload

### Chat System
- GPT-4o-mini chat with full RAG context (evidence + insights + arguments)
- Dual cognitive modes: analytical and conversational
- "Save that" / "Remember this" → auto-saves to insights
- Save / load / archive chat sessions (stored in `userData/chats/`)
- Chat Repository tab for browsing saved conversations
- Custom system prompt (main chat) configurable in Settings

### Narrative Construction
- Main narrative auto-created per case
- Plot points as structural backbone (title, description, date, thread, content)
- Sub-narratives attached to plot points for deep dives
- TipTap rich text editor (left panel) + Narrative Chat assistant (right panel)
- Separate Narrative Chat system prompt configurable in Settings
- Plot point attachment system: link insights and arguments to plot points

### Timeline
- Thread-based grid timeline (plaintiff thread, opposition thread, etc.)
- Zoom levels: year / quarter / month / week
- Compact dot-mode plot points with hover tooltips (title, description, date, attachments)
- Click dot → opens full edit modal
- Drag-and-drop: move plot points between threads and time periods
- Thread reordering via drag-and-drop
- Thread visibility toggle (hide/show)
- Undated plot points section (collapsible, per thread)

### Citation Viewer
- Fuzzy quote matching against uploaded evidence
- Document viewer modal

---

## 🔧 Near-term (MVP Hardening — use the app, fix what breaks)

### Evidence
- [ ] Proper PDF text extraction (`pdf-parse`) — current UTF-8 decode fails on binary
- [ ] Proper DOCX text extraction (`mammoth`) — same issue
- [ ] Progress feedback on upload: Uploading → Extracting → Embedding → Done
- [ ] Show warning in UI when embedding generation fails (currently silent)
- [ ] Evidence inbox / review queue for bot-ingested documents (see Email Pipeline below)

### Timeline
- [ ] Date range filter controls (toolbar already has state, UI not wired)
- [ ] "Peg to timeline" from plot point editor
- [ ] Event date vs evidence date distinction in timeline view

### General
- [ ] Multi-case UI (database supports it, UI only shows first case)
- [ ] Case switcher / case management screen
- [ ] Keyboard shortcuts for common actions
- [ ] README update (still references old Linux paths)

---

## 📬 Email Evidence Pipeline (Designed, Not Built)

**Concept**: An external bot (Python or Node) monitors a designated inbox. When an email arrives from a trusted sender, it downloads attachments, runs Claude to classify and extract metadata, then POSTs to `localhost:3004/api/evidence` with a `pending` status. A review inbox in the app lets you confirm or correct the classification before it lands in the evidence table.

**Architecture**:
1. External IMAP bot (runs independently, not inside the Electron app)
2. Claude triage: classifies `plaintiff / opposition / neutral`, extracts `document_type`, `key_dates`, `key_entities`, `key_claims`, `legal_significance`
3. `pending_evidence` table in SQLite (mirrors `evidence` + `status` field)
4. Review Inbox UI tab: shows Claude's reasoning, confirm / re-classify / reject
5. On accept: record moves to `evidence` table and enters RAG pipeline

**Why external bot, not built-in email client**: avoids building a full IMAP/SMTP client inside Electron. The evidence API is already a clean REST endpoint — the bot just calls it.

---

## 🤖 Research Agents (Concept Stage)

**Idea**: Background agents that run against the accumulated evidence and generate analytical outputs saved as insights or arguments.

**Agent types discussed**:
- **Contradiction Detector** — scans plaintiff vs opposition evidence for conflicting claims on the same facts (dates, amounts, statements). Surfaces as flagged insights.
- **Cross-case Comparator** — compares facts, claims, or precedents across multiple cases in the database. Useful for pattern recognition.
- **Timeline Gap Finder** — identifies periods in the timeline with no evidence, flags them as potential weaknesses.
- **Witness Consistency Checker** — compares statements attributed to the same person across multiple documents.

**Technical approach** (not designed yet):
- Agents would run via the existing `/api/chat` infrastructure or a dedicated `/api/agents` endpoint
- Results saved to `saved_insights` with `category='insight'` and a source tag
- Could be triggered manually ("Run contradiction scan") or on a schedule
- Claude API (Anthropic SDK already installed: `@anthropic-ai/sdk`) is the natural fit here given the analytical nature of the tasks

---

## 🔮 Future (Post-MVP)

- [ ] Real ChromaDB server replacing JSON vector stub (true semantic search)
- [ ] Full-text search across all evidence
- [ ] Document OCR for scanned PDFs
- [ ] Export: generate draft narrative as PDF / Word from plot points
- [ ] Gantt-style timeline visualization alternative
- [ ] Evidence highlighting in chat (which document was cited)
- [ ] Citation tracking: which evidence passages influenced each response
- [ ] Multi-user / shared case support (requires moving off local SQLite)
- [ ] Mobile companion app for quick evidence capture

---

## Architecture Notes for Future Agents

The `@anthropic-ai/sdk` package is already installed. The evidence table has rich metadata columns (`key_claims`, `key_entities`, `document_tone`, `legal_significance`) that agents can query directly from SQLite without needing vector search. The RAG pipeline (`lib/context.ts` → `lib/chroma.ts`) provides the semantic layer on top.

Any new agent endpoint should follow the pattern in `app/api/chat/route.ts`: read API key from settings table, assemble context from SQLite, call Claude, save output back to `saved_insights`.

---

_Last updated: 2026-03-05_
