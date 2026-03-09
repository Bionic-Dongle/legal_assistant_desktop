# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# 🚨 MULTI-AGENT COORDINATION RULES - READ FIRST

## Critical Protocol: Every Session Must Follow

### 0. Session Start (MANDATORY)

Read `notes/CURRENT-STATE.md` before doing anything else. This is how you get up to speed — do not ask the user to brief you.

### 0b. Session End (MANDATORY)

Before the session ends, update `notes/CURRENT-STATE.md`:
- Add a new section with today's date
- List everything built or decided this session (plain English)
- Update the "Immediate Next Steps" section to reflect current state
- If something broke and was fixed, note the fix so it's not forgotten

The user should never have to re-explain context. Keep the notes current.

---

### 1. Session Check-In (MANDATORY)

Before making ANY code changes, you MUST:

1. **Announce Your Task**

   ```
   "I am working on: [specific task name from todo list or user request]"
   ```

2. **List Files You Will Modify**

   ```
   Files I plan to create:
   - [list new files]

   Files I plan to modify:
   - [list existing files]
   ```

3. **Wait for User Confirmation**
   - DO NOT proceed until user approves
   - User may redirect you or clarify scope

### 2. Strict Boundaries

✅ **DO**:
- Work ONLY on your explicitly assigned task
- Ask before modifying any file not in your announced scope
- Stop and ask if you discover a locked file needs changes
- Check git status before modifying files (if modified recently, ask first)

❌ **DON'T**:
- "Help out" by tackling other todo items without being asked
- Refactor or "improve" code you weren't asked to touch
- Modify locked files without explicit owner permission
- Assume related tasks should be done "while you're at it"

### 3. Pre-Modification Checklist

Before editing ANY file, verify:

```
□ Is this file in my assigned scope? (YES/NO)
□ Is this file in the locked files list below? (YES/NO)
□ Was this file modified in the last hour? (check git - if YES, ask user)
□ Did user approve this specific change? (YES/NO)

If ANY answer is NO or uncertain → STOP and ASK USER
```

### 4. If You Need to Modify a Locked File

1. **STOP immediately**
2. Explain to user WHY you think it needs modification
3. List the specific risks (see locked files registry below)
4. Wait for explicit approval

---

# 🔒 LOCKED FILES REGISTRY

**These files are WORKING and FRAGILE. Do NOT modify without owner approval.**

## Evidence Upload System (RAG Core)

**Files**:
- `app/api/evidence/route.ts`
- `lib/db.ts` (schema + migrations)
- `lib/context.ts` (vector retrieval, collection naming, provenance labels)
- `lib/chroma.ts` (vector storage operations, removeDocuments)
- `components/EvidenceTab.tsx`

**Risks if Modified**: Evidence upload breaks, existing evidence becomes unretrievable, RAG context fails silently.

## Chat Integration System

**Files**:
- `components/SettingsTab.tsx`
- `app/api/env/route.ts`
- `app/api/chat/route.ts`

**Risks if Modified**: API keys don't sync, chat returns 401 errors, system prompts not loaded, .env corruption.

## Plot Point Attachment System

**Files**:
- `components/PlotPointEditModal.tsx`
- `components/SelectInsightModal.tsx`
- `app/api/narratives/[narrativeId]/plot-points/route.ts`

**Risks if Modified**: Plot points fail to save, attachments lost, hover tooltips break.

## Verification Commands (Run Before PR Merge)

```bash
# Check database schema has checksum column
node -e "const db = require('better-sqlite3')('./data/legal_assistant.db'); const cols = db.prepare('PRAGMA table_info(evidence)').all(); console.log(cols.find(c => c.name === 'checksum') ? '✅ Schema OK' : '❌ Schema broken');"

# Type check
yarn tsc --noEmit
```

---

# 📋 Project Overview

LegalMind Desktop is a 100% local legal case analysis application — Electron desktop app with Next.js 14. All data stored locally (SQLite + JSON vector storage). No cloud dependencies for core functionality.

## Development Commands

```bash
yarn dev       # Next.js on port 3004 + Electron with hot-reload
yarn build     # Next.js production build (required before packaging)
yarn tsc --noEmit  # Type check
yarn package   # yarn build + Windows NSIS installer → release/
```

## Architecture

### Technology Stack

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript
- **Desktop**: Electron 28 with embedded Next.js server
- **Database**: SQLite (better-sqlite3)
- **Vector Storage**: JSON-based (`lib/chroma.ts`) — keyword matching, upgradeable to ChromaDB
- **AI**: OpenAI GPT-4o-mini (primary) + Anthropic Claude (timeline chat, selectable)
- **Styling**: Tailwind CSS 3.3 + Radix UI

### Electron Security (CRITICAL — DO NOT CHANGE)

```javascript
webPreferences: {
  nodeIntegration: false,   // Must be false
  contextIsolation: true,   // Must be true
  preload: path.join(__dirname, "preload.js"),
}
```

Setting `nodeIntegration: true` or `contextIsolation: false` causes Node globals to leak into the renderer, silently breaking React hydration — UI loads but nothing is clickable.

### IPC Bridge (electron/preload.js)

```typescript
window.electronAPI.getSetting(key)
window.electronAPI.setSetting(key, value)
window.electronAPI.getAppPath()
window.electronAPI.saveChat(chatData)
window.electronAPI.getSavedChats()
window.electronAPI.loadChat(filename)
window.electronAPI.archiveChat(filename)
```

### Database Schema (lib/db.ts)

**Core Tables**:
- `cases`: Case metadata
- `messages`: Chat history (case_id FK)
- `evidence`: Uploaded file metadata — `memory_type` ('plaintiff'|'opposition'|'neutral'), `checksum TEXT UNIQUE` for dedup
- `saved_insights`: Insights/arguments/todos — `category` field ('insight'|'argument'|'todo')
- `narratives`: Main and sub-narratives (`narrative_type`: 'main'|'sub')
- `plot_points`: Key moments with TipTap content + JSON `attachments` column
- `settings`: Key-value config store

**Narrative Architecture**:
```
Main Narrative (one per case, auto-created)
  └─ Plot Points (structural backbone)
      ├─ Direct TipTap content
      └─ Sub-Narratives (optional, attach via plot_point_id)
```

**Important Patterns**:
- TEXT PRIMARY KEY with timestamp-based IDs (e.g., `msg-${Date.now()}-user`)
- Foreign keys cascade delete on case removal
- Default case + main narrative created on first run
- Schema migrations run at startup in `initDatabase()` — always add new columns via `ALTER TABLE` migration block, not by deleting the DB

### Data Flow — AI Context Assembly (app/api/chat/route.ts)

Context sent to OpenAI is assembled from (in order):
1. Base system prompt + optional user-defined system prompt overlay
2. Last 6 messages of conversation history
3. Evidence retrieved by vector similarity to current query — labelled `[AUTHORITATIVE SOURCE MATERIAL]`
4. Insights retrieved by relevance — labelled `[YOUR ANALYTICAL NOTES — your interpretation]`
5. Arguments retrieved by relevance — labelled `[YOUR LEGAL POSITIONS]`

Provenance labels are critical — they tell the AI not to present your notes as document content.

### Vector Store (lib/chroma.ts)

Collections stored as `data/vectors/{collection-name}.json`. Each collection holds documents with text + metadata. Retrieval uses keyword scoring (not true embeddings — embeddings are stored but cosine similarity needs ChromaDB server). `removeDocuments()` is available for cleanup when insights/evidence are deleted.

**Collection naming convention** (must be consistent across API + context builder):
- Evidence: `{memory_type}_{caseId}` → e.g., `plaintiff_default-case-123`
- Insights: `insights_{caseId}`
- Arguments: `arguments_{caseId}`

### Text Extraction (lib/extract.ts)

`extractText(buffer, filename, limit?)` returns `{ text, method }`. Handles:
- `.pdf` → `pdf-parse` (graceful fallback for scanned PDFs with no text layer)
- `.docx`/`.doc` → `mammoth`
- Everything else → UTF-8

Called by `app/api/evidence/route.ts` server-side. The frontend (`EvidenceTab.tsx`) sends an empty `extractedText` for binary files — the server does the real extraction.

### Evidence Vectorization

When insights or arguments are **saved**, they are immediately added to their vector collection (`app/api/insights/route.ts`). When **deleted**, `removeDocuments()` removes them from the vector store. Any insights saved before this pipeline existed are only in SQLite and won't appear in relevance retrieval until re-saved.

### AI Provider Selection

Timeline chat (`app/api/timeline-chat/route.ts`) supports both OpenAI and Anthropic Claude. The provider is selected by `settings.timeline_api_preference` ('openai' | 'anthropic'). Settings keys: `openai_key`, `anthropic_api_key`. The main chat always uses OpenAI.

## Evidence Ingestion — Two Paths

### Path 1 — Cowork Import Pipeline (primary, for bulk/email/image ingestion)

Cowork (Claude Desktop's agent tab) reads emails, documents, and images, then writes structured JSON to `data/import-queue/email-import-queue.json`. See `notes/COWORK.md` for the exact triage prompt.

1. Cowork processes evidence → writes JSON array to queue file
2. LegalMind Evidence tab shows blue `ImportQueuePanel` banner when items are waiting
3. Click "Import Now" → `POST /api/evidence/import-queue` ingests all items with full metadata, embeddings, and dedup
4. Processed items archived to `email-import-queue-processed.json`

**Import queue JSON fields**: `id` (SHA-256 for dedup), `filename`, `memory_type`, `party`, `document_type`, `actual_author`, `extracted_text`, `key_dates`, `key_entities`, `key_claims`, `document_tone`, `legal_significance`, etc.

**GDrive folders** (download locally, Cowork reads from disk):
```
data/gdrive-import/plaintiff/    ← plaintiff discovery docs
data/gdrive-import/opposition/   ← opposition discovery docs
```

### Path 2 — Direct Upload (for individual documents)

Drag-drop in Evidence tab → `POST /api/evidence` → file saved to `data/evidence/`, text extracted via `lib/extract.ts`, embedding generated, stored in vector collection.

## Local Data Storage

```
data/
├── legal_assistant.db         # SQLite database
├── evidence/                  # Uploaded files (timestamped filenames)
├── vectors/                   # JSON vector collections per type/case
├── import-queue/              # Cowork writes here; LegalMind reads and archives
│   ├── email-import-queue.json
│   └── email-import-queue-processed.json
└── gdrive-import/
    ├── plaintiff/
    └── opposition/

userData/chats/                # Chat sessions (Electron userData, not data/)
    ├── chat-{timestamp}.json
    └── archive/
```

## Tab Navigation Structure (app/page.tsx)

Three dropdown menus using Radix UI:

1. **Workspace** — Chat, Narrative Construction, Chat Repository
2. **Case Materials** — Evidence, Key Insights, Arguments
3. **Utilities** — To-Do, Settings, Baserow (conditional)

`InsightsTab` is reused for all three category tabs via `category` prop ('insight'|'argument'|'todo').

## API Routes

```
/api/chat                              # Main chat (OpenAI, RAG context)
/api/narrative-chat                    # Narrative assistant (narrative-aware context)
/api/timeline-chat                     # Timeline chat (OpenAI or Anthropic, selectable)
/api/timeline-chat/upload              # Upload doc to timeline
/api/timeline-chat/analyze-document    # Analyze document for timeline
/api/evidence                          # Upload, list, delete evidence
/api/evidence/import-queue             # Cowork import queue (GET count, POST import)
/api/evidence/by-filename              # Lookup evidence by filename
/api/evidence-upload-chat              # Upload Bot AI assistant
/api/document-analysis                 # Document analysis
/api/legal-research                    # Legal research assistant
/api/insights                          # CRUD for insights/arguments/todos (vectorizes on save)
/api/narratives                        # Fetch/create narratives
/api/narratives/[id]/plot-points       # CRUD for plot points
/api/narratives/[id]/plot-points/[id]  # Update/delete specific plot point
/api/narratives/[id]/sections          # Narrative sections
/api/plot-points/[id]/sub-narratives   # Sub-narratives for a plot point
/api/narrative-threads                 # Narrative threads
/api/settings                          # Key-value settings persistence
/api/env                               # Write API key to .env + runtime env sync
/api/cases                             # Case management
/api/messages                          # Message history
/api/baserow/test                      # Baserow connection test (optional)
```

## Settings & Environment Sync

When user saves API key in Settings UI:
1. Stored in SQLite via `/api/settings`
2. Written to `.env` via `/api/env`
3. `process.env.OPENAI_API_KEY` updated at runtime immediately

This three-way sync (UI → DB → .env → runtime) is why the settings/env/chat files are locked. Breaking it causes 401 errors with no clear error message.

System prompt keys checked (multiple variants for compatibility): `main_chat_system_prompt`, `system_prompt_main`, `custom_system_prompt`. Timeline uses `system_prompt_timeline`. Narrative chat uses its own key. Global rules stored at `global_rules` apply across chat routes.

## Common Development Patterns

**Adding New Tab**:
1. Create component in `components/`
2. Add to the appropriate dropdown + TabsContent in `app/page.tsx`
3. Add `m-0` and overflow handling on TabsContent

**Modifying Database Schema**:
1. Add new column in `lib/db.ts initDatabase()` CREATE TABLE statement
2. Add migration block: `db.prepare('ALTER TABLE ... ADD COLUMN ...').run()` wrapped in try-catch (SQLite errors if column already exists)
3. In dev: deleting `data/legal_assistant.db` recreates schema from scratch

**Adding New API Endpoint**:
1. Create `app/api/{name}/route.ts`
2. Export named `GET`/`POST`/`PUT`/`DELETE` functions
3. Import `db` from `@/lib/db`, use prepared statements, return `NextResponse.json()`

**TipTap Editor**: Always configure with `immediatelyRender: false` to prevent SSR hydration errors.

**Avoiding SSR module errors**: Never call constructors or access module-level state at import time. Use lazy initialization (e.g., `getDmp()` singleton pattern in `DocumentViewerModal.tsx`).

## TypeScript

Path alias `@/*` resolves to project root:
```typescript
import db from "@/lib/db";
import { Button } from "@/components/ui/button";
```

## Notes Directory

`notes/` contains session notes — not code, not committed by default:
- `ARCHITECTURE.md` — architectural vision and direction
- `CURRENT-STATE.md` — what works, what was fixed, next steps
- `COWORK.md` — the full Cowork triage prompt + import workflow

## Git Workflow

- `main` — stable production
- `dev` — integration branch for testing
- Feature branches off `dev` → PR to `dev` → PR to `main`
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, etc.

## Future Enhancements (Not Yet Built)

- Knowledge graph tables (`entities`, `relationships`) for GraphRAG-style multi-hop retrieval
- Real ChromaDB server with cosine similarity (current: keyword scoring)
- Timeline visualization (Gantt-style)
- "Generate Final Draft" assembly from plot points
- Multi-case UI (currently fixed to first case)
- Playwright regression testing
