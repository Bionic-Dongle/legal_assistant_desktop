# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

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
import db from '@/lib/db';
import { Button } from '@/components/ui/button';
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
