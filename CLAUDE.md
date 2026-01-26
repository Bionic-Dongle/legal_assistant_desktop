# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# 🚨 MULTI-AGENT COORDINATION RULES - READ FIRST

## Critical Protocol: Every Session Must Follow

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
5. Document the change reason in comments
6. Test thoroughly after modification

---

# 🔒 LOCKED FILES REGISTRY

**These files are WORKING and FRAGILE. Do NOT modify without owner approval.**

## Evidence Upload System (RAG Core)

**Files**:

- `app/api/evidence/route.ts`
- `lib/db.ts` (evidence table schema, migrations)
- `lib/context.ts` (vector retrieval, collection naming)
- `lib/chroma.ts` (vector storage operations)
- `components/EvidenceTab.tsx`

**Why Locked**:

- Schema changes without migrations = broken databases
- Collection naming changes = RAG retrieval fails silently
- API/DB mismatches = "Upload failed" errors with no recovery
- This is the core value proposition of the app

**Risks if Modified**:

- Evidence upload completely broken
- Existing evidence becomes unretrievable
- Vector embeddings lost
- Chat context assembly fails

---

## Chat Integration System

**Files**:

- `components/SettingsTab.tsx` (Settings UI)
- `app/api/env/route.ts` (Environment updates)
- `app/api/chat/route.ts` (Chat API, system prompts)

**Why Locked**:

- Tightly coupled .env sync system
- Dynamic API key updates
- System prompt loading logic
- Any change can break OpenAI connection

**Risks if Modified**:

- API keys don't sync between UI and runtime
- Chat stops working (401 errors)
- System prompts not loaded
- .env file corruption

---

## Plot Point Attachment System (NEW - 2026-01-07)

**Files**:

- `components/PlotPointEditModal.tsx`
- `components/SelectInsightModal.tsx`
- `app/api/narratives/[narrativeId]/plot-points/route.ts`
- `lib/db.ts` (plot_points table with attachments column)

**Why Locked**:

- JSON attachment structure in database
- Modal interaction patterns
- API parameter naming (caseId vs case_id)
- Insight/argument retrieval logic

**Risks if Modified**:

- Plot points fail to save
- Attachments lost or corrupted
- Insight/argument selection breaks
- Hover tooltips stop working

---

## Verification Commands (Run Before PR Merge)

```bash
# 1. Check database schema matches code
node -e "const db = require('better-sqlite3')('./data/legal_assistant.db'); const cols = db.prepare('PRAGMA table_info(evidence)').all(); console.log(cols.find(c => c.name === 'checksum') ? '✅ Schema OK' : '❌ Schema broken');"

# 2. Type check passes
yarn tsc --noEmit

# 3. Check for console errors on startup
yarn dev
```

---

# 📋 Project Overview

LegalMind Desktop is a 100% local legal case analysis application built as an Electron desktop app with Next.js 14. All data is stored locally using SQLite and JSON-based vector storage. No cloud dependencies are required for core functionality.

## Development Commands

### Starting Development

```bash
yarn dev
```

Runs Next.js dev server on port 3004 and launches Electron window with hot-reload enabled.

### Building

```bash
yarn build
```

Builds Next.js production bundle. Required before packaging.

### Type Checking

```bash
yarn tsc --noEmit
```

Check for TypeScript errors without emitting files.

### Creating Windows Installer

```bash
yarn package
```

Creates `Legal Assistant Setup.exe` in `release/` folder. Must run `yarn build` first.

## Architecture

### Technology Stack

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript
- **Desktop**: Electron 28 with embedded Next.js server
- **Database**: SQLite (better-sqlite3) for structured data
- **Vector Storage**: JSON-based simple vector storage (lib/chroma.ts)
- **AI**: Optional OpenAI GPT-4o-mini integration
- **Styling**: Tailwind CSS 3.3 + Radix UI components

### Data Flow Architecture

**1. Multi-Repository System**
The app maintains three conceptual data repositories:

- **Evidence Repository**: Uploaded documents stored in `data/evidence/` with metadata in SQLite `evidence` table
- **Insights Repository**: Key legal insights saved in `saved_insights` table (category='insight')
- **Arguments Repository**: Legal positions saved in `saved_insights` table (category='argument')

**2. AI Context Assembly** (app/api/chat/route.ts:57-103)
When processing chat messages, the system builds context from:

- Base system prompt with dual cognitive modes (analytical + conversational)
- Optional custom system prompt overlay from settings
- Recent conversation history (last 6 messages for continuity)
- Vector search results from plaintiff/opposition evidence
- All saved insights and arguments
- This context is passed to OpenAI API or generates mock response if no API key

**3. Vector Search Pattern** (lib/chroma.ts)
Simple JSON-based keyword matching (not true embeddings):

- Collections stored as `data/vectors/{collection-name}.json`
- Basic scoring by keyword overlap
- Upgradeable to ChromaDB server with real embeddings

### Database Schema (lib/db.ts)

**Core Tables**:

- `cases`: Case metadata (id, title, description)
- `messages`: Chat conversation history (linked to case_id)
- `evidence`: Uploaded files metadata with memory_type ('plaintiff'|'opposition')
- `saved_insights`: Multi-purpose storage for insights/arguments/todos with category field
- `narratives`: Main and sub-narratives (narrative_type: 'main' | 'sub')
- `plot_points`: Key moments in main narrative with content
- `settings`: Key-value configuration store

**Narrative Construction Architecture**:

```
Main Narrative (one per case, auto-created)
  └─ Plot Points (key moments/events)
      ├─ Direct content (TipTap rich text)
      └─ Sub-Narratives (optional deep dives)
          └─ Content for detailed exploration
```

**Key Relationships**:

- Each case has exactly ONE main narrative (auto-created on initialization)
- Main narrative contains multiple plot points (structural backbone)
- Sub-narratives attach to specific plot points via `plot_point_id`
- Not all plot points require sub-narratives
- But all sub-narratives must belong to a plot point

**Important Patterns**:

- All tables use TEXT PRIMARY KEY with timestamp-based IDs (e.g., `msg-${Date.now()}-user`)
- Foreign keys cascade delete on case removal
- Indexes on all case_id foreign keys for performance
- Default case AND main narrative created on first run if none exists

### Electron Integration (electron/main.js)

**Production vs Development**:

- **Dev mode**: Electron loads http://localhost:3004 (expects `yarn dev` running)
- **Production**: Electron starts embedded HTTP server with Next.js handler on port 3004

**Security Configuration** (CRITICAL - DO NOT CHANGE):

```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, "preload.js"),
}
```

- **Why this matters**: Modern React/Next.js/Radix require a pure browser context. Setting `nodeIntegration: true` or `contextIsolation: false` causes Node globals to leak into the renderer process, which breaks React's event system and hydration silently. The app will load but nothing will be clickable.
- After dependency updates, this misconfiguration manifested as all UI elements being visible but completely non-interactive (tabs, buttons, inputs all unresponsive).

**Settings Storage**:

- Uses electron-store for persistent settings (separate from SQLite)
- IPC handlers exposed via contextBridge in `preload.js`
- Access in renderer: `window.electronAPI.getSetting(key)`, `window.electronAPI.setSetting(key, value)`, `window.electronAPI.getAppPath()`

### Chat Management System

**Overview**:
The application features a complete chat session management system that allows users to save, load, archive, and manage multiple conversations entirely within the app interface.

**Core Fixes & Configuration**:

- Fixed Electron configuration by ensuring `contextIsolation: true` and `nodeIntegration: false` to restore React hydration
- Removed auto-opening DevTools on launch for cleaner user experience

**Save Chat Modal** (components/SaveChatModal.tsx):

- Custom in-app modal replacing browser file dialogs
- Features:
  - Name input for chat title
  - Description textarea for chat summary
  - One-click silent saving to internal storage
- All chats saved to `userData/chats/` with unique filenames
- No OS dialogs required - fully integrated UI experience

**Session Isolation**:

- Each chat session carries a unique `sessionId`
- Messages are saved and reloaded per session
- Eliminates chat merging when reopening or switching between chats
- Last opened chat session automatically loaded via `localStorage`

**Chat Repository Tab** (components/ChatRepositoryTab.tsx):

- Dedicated tab for browsing and managing stored conversations
- Features:
  - Display all saved chats with name, description, and metadata
  - "Open Chat" button to load conversation directly into ChatTab
  - "Archive" button to move chats to `userData/chats/archive/`
  - "Copy JSON" for raw export (optional debugging)
  - Search/filter functionality for finding specific chats
- View updates dynamically after archiving or loading operations

**ChatTab Enhancements** (components/ChatTab.tsx):

- "Clear Chat" button for instant session reset
- Seamless switching between chats while keeping other sessions intact
- Automatically loads last opened chat on app start
- Session state persisted independently per chat

**IPC Bridge Implementation** (electron/preload.js):
Secure IPC handlers exposed via contextBridge:

- `window.electronAPI.saveChat(chatData)` - Save chat to userData/chats/
- `window.electronAPI.getSavedChats()` - Retrieve list of all saved chats
- `window.electronAPI.loadChat(filename)` - Load specific chat by filename
- `window.electronAPI.archiveChat(filename)` - Move chat to archive folder

**Storage Structure**:

```
userData/
└── chats/
    ├── chat-{timestamp}.json        # Active chats
    ├── chat-{timestamp}.json
    └── archive/
        └── chat-{timestamp}.json    # Archived chats
```

**Key Benefits**:

- No reliance on OS file dialogs - pure in-app experience
- Complete session isolation prevents conversation mixing
- Archive system for decluttering without deletion
- All operations handled natively through Electron IPC
- Maintains local-first, privacy-focused architecture

### Narrative Construction System (Phase 1a - COMPLETED)

**Overview**:
The Narrative Construction system provides a structured approach to building legal narratives with plot points as the organizational backbone. Users can create a main narrative with key moments (plot points) and optionally add sub-narratives for detailed exploration.

**Core Architecture - Plot Points System**:

```
Main Narrative (auto-created, one per case)
  │
  ├─ Plot Point 1: "Incident Occurred"
  │   ├─ Direct content in TipTap editor
  │   ├─ Sub-Narrative: "Witness A's Account" (optional)
  │   └─ Sub-Narrative: "Medical Evidence Thread" (optional)
  │
  ├─ Plot Point 2: "Hospital Admission"
  │   └─ Direct content (no sub-narratives needed)
  │
  └─ Plot Point 3: "Police Report Filed"
      └─ Sub-Narrative: "Chain of Custody Analysis"
```

**Design Philosophy**:

- Plot points force organization around key moments
- Sub-narratives only when depth is needed
- Not every plot point requires sub-narratives
- But every sub-narrative must attach to a plot point
- This prevents unstructured narrative sprawl

**NarrativeConstructionTab** (components/NarrativeConstructionTab.tsx):

**Two-Panel Layout**:

- **Left Panel**: TipTap rich text editor for writing
- **Right Panel**: Narrative Chat assistant with context awareness

**Toolbar Features**:

- "+ Plot Point" - Create new key moment in main narrative
- "+ Sub-Narrative" - Add detailed exploration to selected plot point (disabled until plot point selected)
- "Save" - Persist current plot point/sub-narrative content

**Workflow**:

1. User clicks "+ Plot Point" → Modal asks for title → Creates plot point
2. Select plot point from dropdown → Content loads in TipTap editor
3. Edit and click "Save" to persist
4. Optional: Click "+ Sub-Narrative" → Modal asks for title → Attaches to current plot point
5. Switch between "Main Plot Point Content" and sub-narratives via dropdown

**Dual System Prompts** (Settings):

- **Main Chat System Prompt**: For strategic case analysis (ChatTab)
- **Narrative Chat System Prompt**: For persuasive writing assistance (NarrativeConstructionTab)
- Both customizable in Settings tab
- Narrative chat receives context about current plot point, sub-narratives, insights, and arguments

**API Endpoints**:

- `GET /api/narratives?case_id={id}` - Fetch all narratives (main + subs)
- `POST /api/narratives` - Create sub-narrative (main auto-created)
- `GET /api/narratives/{id}/plot-points` - Fetch plot points for narrative
- `POST /api/narratives/{id}/plot-points` - Create new plot point
- `PUT /api/narratives/{id}/plot-points/{plotId}` - Update plot point content
- `GET /api/plot-points/{id}/sub-narratives` - Fetch sub-narratives for plot point
- `POST /api/narrative-chat` - AI assistant with narrative context

**Key Implementation Details**:

- TipTap configured with `immediatelyRender: false` to prevent SSR hydration issues
- InputModal component replaces browser `prompt()` (not supported in Next.js)
- Auto-initialization ensures one main narrative per case on startup
- Plot point selector required; sub-narrative selector optional

**Current Status (MVP)**:
✅ Tab reorganization with dropdown menus (Workspace, Case Materials, Utilities)
✅ Dual system prompts in Settings
✅ Plot points database schema with cascade deletes
✅ TipTap rich text editor integration
✅ Two-panel layout (editor + narrative chat)
✅ Plot point creation and editing
✅ Sub-narrative creation and attachment
✅ Context-aware narrative chat assistant

**Future Enhancements (Phase 1b+)**:

- Date/time input for plot points (for timeline integration)
- "Peg to Timeline" feature for chronological organization
- Evidence attachment to plot points
- Insights/snippets linking
- Gantt-style timeline visualization
- "Generate Final Draft" assembly feature

**Important Notes**:

- Deleting database requires restart to regenerate schema
- Evidence files survive database deletion (stored in `data/evidence/`)
- Chat repository independent of case database (stored in `userData/chats/`)
- One main narrative per case is enforced at initialization

### Component Structure

**Page Layout** (app/page.tsx):

- Reorganized tabbed interface with three dropdown menus for better organization
- Uses Radix UI dropdown menus + tabs with icons from lucide-react

**Dropdown Menu Structure**:

1. **Workspace** (Hammer icon)

   - Chat (MessageSquare)
   - Narrative Construction (FileText)
   - Chat Repository (FolderOpen)

2. **Case Materials** (Briefcase icon)

   - Evidence (FileText)
   - Key Insights (Lightbulb)
   - Arguments (Scale)

3. **Utilities** (Wrench icon)
   - To-Do (CheckSquare)
   - Settings (Settings)
   - Baserow (Database - conditional, based on settings)

**Reusable Pattern**:

- InsightsTab component handles three categories by accepting `category` prop: 'insight', 'argument', 'todo'
- All tabs receive `caseId` prop for multi-case support (though UI currently shows only first case)
- NarrativeConstructionTab receives `caseId` and loads main narrative automatically

### API Routes Pattern

All routes in `app/api/**/route.ts` follow Next.js 13+ App Router conventions:

- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Import `db` from '@/lib/db' for SQLite operations
- Return `NextResponse.json()`
- Use try-catch with 500 error responses

**Key Routes**:

- `/api/chat` - Main AI interaction endpoint with context assembly
- `/api/evidence` - File upload handler (saves to `data/evidence/`)
- `/api/insights` - CRUD for saved insights/arguments/todos
- `/api/settings` - Key-value settings persistence
- `/api/narratives` - Fetch and create narratives (main auto-created)
- `/api/narratives/[narrativeId]/plot-points` - CRUD for plot points
- `/api/narratives/[narrativeId]/plot-points/[plotPointId]` - Update/delete specific plot point
- `/api/plot-points/[plotPointId]/sub-narratives` - Fetch sub-narratives for plot point
- `/api/narrative-chat` - AI assistant with narrative-aware context
- `/api/baserow/test` - Optional Baserow connection testing

## Local Data Storage

All data lives in `data/` directory (gitignored):

```
data/
├── legal_assistant.db    # SQLite database
├── evidence/             # Uploaded files
└── vectors/              # JSON vector collections
```

**Windows Paths**: When constructing file paths in Electron, use `path.join()` and be aware of Windows drive letters.

## AI Integration Details

**"Save That" Command** (app/api/chat/route.ts:16-39):

- User says "save that" or "remember this"
- System fetches last assistant message
- Saves to saved_insights with category='insight'
- Returns confirmation message

**Mock Response Fallback** (app/api/chat/route.ts:154-168):

- When no OpenAI key configured, generates helpful mock responses
- Provides setup instructions
- Still saves conversation to database

**Model Configuration**:

- Uses gpt-4o-mini with temperature=0.8, top_p=0.9
- Conversation history limited to last 6 messages for cost/context management

## System Architecture Notes — LegalMind Chat Integration

### Overview

The LegalMind chat system integrates a local database, dynamic environment configuration, and OpenAI API connectivity. It is designed for **local-first privacy**, **dynamic configuration**, and **prompt-driven reasoning**. The architecture ensures that both the API key and system prompts are fully synchronized between the UI, backend, and runtime environment.

---

### Key Components

1. **Settings UI (`components/SettingsTab.tsx`)**

   - Provides user controls for configuring the OpenAI API key, model, and system prompts.
   - When the user saves settings:
     - The data is stored in the local SQLite database via `/api/settings`.
     - The API key is immediately written to the `.env` file via `/api/env`.
     - The runtime environment variable (`process.env.OPENAI_API_KEY`) is updated instantly.
   - This ensures the backend always uses the latest key without requiring a restart.

2. **Environment Update API (`app/api/env/route.ts`)**

   - Handles secure updates to the `.env` file.
   - Accepts JSON payloads like `{ key: 'OPENAI_API_KEY', value: 'sk-...' }`.
   - Updates or inserts the key-value pair in `.env` and refreshes the runtime environment variable.
   - Guarantees immediate synchronization between the UI and backend configuration.

3. **Chat API (`app/api/chat/route.ts`)**

   - Handles all chat interactions with the OpenAI API.
   - Dynamically retrieves the API key from either the environment variable or database.
   - Loads system prompts from the database, checking multiple key variants (`main_chat_system_prompt`, `system_prompt_main`, `custom_system_prompt`, etc.) to ensure compatibility.
   - Builds a composite system prompt that merges user-defined behavior with contextual case data.
   - Sends structured messages to OpenAI's API for reasoning and response generation.

4. **Database (`lib/db.ts`)**
   - Stores all user settings, messages, and contextual data.
   - Acts as the single source of truth for system prompts and configuration values.

---

### Design Principles

- **Dynamic Configuration:** The `.env` file and runtime environment are updated instantly when the user changes the API key.
- **Resilience:** The chat route automatically falls back to mock responses if the API key is missing or invalid.
- **Prompt Flexibility:** The system supports multiple prompt key variants to prevent future compatibility issues.
- **Local Privacy:** All data, including chat history and evidence, is stored locally — no cloud dependencies.

---

### Critical Maintenance Note

> ⚠️ **Do not modify or refactor the following files without explicit authorization:**
>
> - `components/SettingsTab.tsx`
> - `app/api/env/route.ts`
> - `app/api/chat/route.ts`
>
> These files are tightly coupled to ensure dynamic synchronization between the UI, `.env` file, and backend runtime. Any changes to their logic can break the OpenAI connection, prompt loading, or environment updates.
>
> Only modify these components under direct instruction from the project owner.

---

### Current Status

✅ The system is now fully functional:

- The OpenAI API key dynamically updates from the UI.
- The `.env` file and runtime environment remain synchronized.
- The chat correctly loads and applies user-defined prompts.
- The 401 error and prompt desynchronization issues have been resolved permanently.

---

## Evidence Upload System & RAG Architecture

### System Overview

The Evidence Upload system is a critical component of LegalMind's **Retrieval-Augmented Generation (RAG)** architecture. It allows users to upload legal documents (plaintiff/opposition evidence) which are then:

1. Stored locally in `data/evidence/`
2. Embedded using OpenAI's `text-embedding-3-small` model
3. Stored in vector collections via `lib/chroma.ts`
4. Retrieved during chat interactions to provide context-aware responses

### Architecture Flow

```
User Upload → File Storage → Text Extraction → Embedding Generation → Vector Store → RAG Retrieval
     ↓              ↓               ↓                    ↓                  ↓             ↓
EvidenceTab.tsx  /api/evidence  buffer.toString()  OpenAI API      addDocuments()  buildCaseContext()
```

### Components

**1. Frontend (`components/EvidenceTab.tsx`)**

- Drag-and-drop upload areas for plaintiff/opposition evidence
- Accepts: `.pdf`, `.doc`, `.docx`, `.txt`
- Sends FormData with: `file`, `caseId`, `memoryType`
- Displays uploaded evidence list with delete functionality

**2. Upload API (`app/api/evidence/route.ts`)**

- **POST**: Handles file upload
  - Generates SHA-256 checksum for duplicate detection
  - Saves file to `data/evidence/` with timestamped filename
  - Extracts text content (first 10,000 chars)
  - Generates embedding vector via OpenAI API (if key present)
  - Stores in vector collection: `{memoryType}_{caseId}` (e.g., `plaintiff_default-case-123`)
  - Saves metadata to SQLite `evidence` table
- **GET**: Retrieves evidence list for case
- **DELETE**: Removes file and database record

**3. Vector Storage (`lib/chroma.ts`)**

- Simple JSON-based vector storage (stub for future ChromaDB integration)
- Collections stored as: `data/vectors/{collection-name}.json`
- Basic keyword matching scoring (not true semantic search)
- Upgradeable to real embeddings-based search

**4. Context Builder (`lib/context.ts`)**

- `buildCaseContext()` function queries vector stores
- Retrieves relevant evidence passages based on user query
- Assembles context from:
  - Evidence (plaintiff/opposition)
  - Saved insights
  - Saved arguments
  - Future: Case law precedents
- Context fed to OpenAI chat completions

**5. Database Schema (`lib/db.ts`)**

- `evidence` table columns:
  - `id`, `case_id`, `filename`, `filepath`, `memory_type`
  - `party`, `knowledge_domain`, `embedding_present`
  - `uploaded_at`

---

### 🔴 CRITICAL ISSUE DISCOVERED (2026-01-05)

**Problem**: Evidence upload system is **BROKEN** due to schema mismatch.

**Root Cause**:
The `app/api/evidence/route.ts` file was modified to include duplicate detection using a `checksum` column:

- Line 45: Generates SHA-256 checksum
- Line 48: Queries `SELECT id FROM evidence WHERE checksum = ?`
- Line 106: Inserts with `checksum` value

However, the `evidence` table schema in `lib/db.ts` **DOES NOT INCLUDE** the `checksum` column.

**Impact**:

- All evidence uploads fail with SQL error: "table evidence has no column named checksum"
- RAG system cannot ingest new documents
- Chat cannot access uploaded evidence context
- Users see "Upload failed" toast with no details

**Evidence**:

```sql
-- Current schema (missing checksum):
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  party TEXT DEFAULT 'neutral',
  knowledge_domain TEXT DEFAULT 'evidence',
  embedding_present BOOLEAN DEFAULT 0,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Required Fix**:

```sql
ALTER TABLE evidence ADD COLUMN checksum TEXT UNIQUE;
```

---

### 🛠️ REPAIR PLAN

**Phase 1: Database Migration**

1. Add `checksum` column to `evidence` table schema in `lib/db.ts`
2. Create migration logic to add column to existing databases
3. Backfill checksums for existing evidence files

**Phase 2: Testing**

1. Test upload with plaintiff evidence
2. Test upload with opposition evidence
3. Verify vector storage creation
4. Verify chat context retrieval
5. Test duplicate detection

**Phase 3: RAG Verification**

1. Upload test document with known content
2. Ask chat question requiring that evidence
3. Verify context assembly includes evidence
4. Confirm OpenAI response uses retrieved context

**Phase 4: Future Enhancements**

1. Integrate real ChromaDB server (replace JSON stubs)
2. Add case law precedent vector store
3. Implement semantic search scoring
4. Add evidence highlighting in chat responses
5. Enable citation tracking (which evidence was used)

---

### Additional Issues Found

**1. Text Extraction Limitation**

- Current: `buffer.toString("utf-8").substring(0, 10000)`
- Problem: Binary files (PDF, DOCX) cannot be decoded as UTF-8
- Solution: Integrate `pdf-parse` and `mammoth` libraries for proper text extraction

**2. Embedding Generation Silent Failure**

- Current: Wraps in try-catch, logs warning, continues without embedding
- Problem: No user notification when embeddings fail
- Solution: Return warning in response, set `embedding_present` flag

**3. Vector Collection Naming Inconsistency**

- API uses: `{memoryType}_{caseId}` (e.g., `plaintiff_default-case-123`)
- Context builder uses: `{party || knowledge_domain}_{caseId}`
- Problem: Collections may not match during retrieval
- Solution: Standardize collection naming convention

**4. No Progress Feedback**

- Uploads happen silently with spinner
- User doesn't know if embedding is being generated
- Solution: Add progress states: "Uploading → Processing → Embedding → Complete"

---

### Critical Maintenance Note

> ⚠️ **Do not modify the evidence upload system without:**
>
> 1. Ensuring database schema matches API expectations
> 2. Testing with real PDF/DOCX files (not just .txt)
> 3. Verifying vector store creation
> 4. Confirming chat retrieval works end-to-end
> 5. Checking duplicate detection logic
>
> The RAG system is the **core value proposition** of LegalMind. If evidence cannot be uploaded and retrieved, the entire application loses its primary function.

---

### Testing Checklist (Before Production)

- [ ] Upload .txt file → verify storage + embedding
- [ ] Upload .pdf file → verify text extraction works
- [ ] Upload .docx file → verify text extraction works
- [ ] Upload duplicate file → verify rejection with message
- [ ] Ask chat question → verify evidence context retrieved
- [ ] Test with no API key → verify graceful degradation
- [ ] Delete evidence → verify file + DB + vector store cleanup

---

### ✅ REPAIR COMPLETED (2026-01-05)

**Status**: Evidence upload system FIXED and LOCKED DOWN.

**Changes Made**:

1. ✅ Added `checksum TEXT UNIQUE` column to evidence table schema ([lib/db.ts:48](lib/db.ts#L48))
2. ✅ Added automatic migration for existing databases ([lib/db.ts:161-173](lib/db.ts#L161-L173))
3. ✅ Fixed collection naming to use `memory_type` consistently ([lib/context.ts:36-46](lib/context.ts#L36-L46))
4. ✅ Tested schema migration on existing database

**Lock-Down Procedures**:

> 🔒 **CRITICAL: The following files are now LOCKED and must not be modified without explicit owner authorization:**
>
> **Evidence Upload System (RAG Core)**:
>
> - `app/api/evidence/route.ts` - Upload handler, checksum logic, embedding generation
> - `lib/db.ts` - Database schema, migration logic
> - `lib/context.ts` - Vector retrieval, collection naming
> - `lib/chroma.ts` - Vector storage operations
> - `components/EvidenceTab.tsx` - Upload UI
>
> **Chat Integration System**:
>
> - `components/SettingsTab.tsx` - Settings UI
> - `app/api/env/route.ts` - Environment updates
> - `app/api/chat/route.ts` - Chat API, system prompts
>
> **Why These Files Are Locked**:
>
> - Schema changes without migrations = broken databases
> - Collection naming changes = RAG retrieval fails silently
> - API/DB mismatches = "Upload failed" errors with no recovery
> - These systems are tightly coupled and fragile

**Verification Commands** (Run before any PR merge):

```bash
# 1. Check database schema matches code
node -e "const db = require('better-sqlite3')('./data/legal_assistant.db'); const cols = db.prepare('PRAGMA table_info(evidence)').all(); console.log(cols.find(c => c.name === 'checksum') ? '✅ Schema OK' : '❌ Schema broken');"

# 2. Check collection naming consistency
grep -n "collectionName.*memoryType" app/api/evidence/route.ts
grep -n "memory_type.*caseId" lib/context.ts

# 3. Type check passes
yarn tsc --noEmit
```

**How to Request Changes to Locked Files**:

1. Open GitHub issue describing needed change
2. Tag as `critical-system-modification`
3. Wait for owner approval
4. Create PR with full test coverage
5. Run verification commands
6. Document migration path if schema changes

---

## Common Development Patterns

**Adding New Tab**:

1. Create component in `components/`
2. Add to TabsList in `app/page.tsx`
3. Add TabsContent with m-0 and overflow handling
4. Import icon from lucide-react

**Modifying Database Schema**:

1. Update table definitions in `lib/db.ts` initDatabase()
2. Delete `data/legal_assistant.db` (dev only - will recreate)
3. For production, write migration logic

**Adding New API Endpoint**:

1. Create `app/api/{name}/route.ts`
2. Export POST/GET functions
3. Import db, use prepared statements
4. Return NextResponse.json()

## TypeScript Configuration

Path alias `@/*` resolves to project root. Use for imports:

```typescript
import db from "@/lib/db";
import { Button } from "@/components/ui/button";
```

## Baserow Integration (Optional)

When enabled via Settings:

- Toggle appears in settings
- Baserow tab becomes visible
- Connection test endpoint: `/api/baserow/test`
- Currently placeholder UI (future enhancement)

## Future Enhancement Notes

The codebase has hooks for features marked "coming soon":

- Full ChromaDB server with real embeddings (lib/chroma.ts is stub)
- Multi-case UI management (currently shows first case only)
- Document OCR
- Timeline visualization
- Export to PDF/Word

When implementing these, maintain the local-first, privacy-focused architecture.

## Git Workflow Protocol

### Branching Strategy

- Use `main` as the stable production branch.
- Use `dev` as the integration branch for testing new features.
- Create feature branches off `dev` for individual tasks or features.

### Commit Message Conventions

- Use Conventional Commits format: `type: description`.
  - Types include: feat, fix, chore, docs, refactor, test, etc.

### Pushing Changes to Remote Branches

1. Create a feature branch off `dev` for your work.
2. Commit changes locally with consistent commit messages.
3. Push the feature branch to the remote repository.
4. Open a pull request to merge the feature branch into `dev`.
5. After testing on `dev`, open a pull request to merge `dev` into `main`.
6. Push the `main` branch to the remote repository for production deployment.

### Explanation of Pushing Process

- Feature branches isolate individual tasks to keep work organized.
- Consistent commit messages improve history readability and automation.
- Pull requests enable code review and discussion before integration.
- Testing on `dev` ensures stability before production release.

---
