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
- `narratives`: Case narrative summaries
- `settings`: Key-value configuration store

**Important Patterns**:
- All tables use TEXT PRIMARY KEY with timestamp-based IDs (e.g., `msg-${Date.now()}-user`)
- Foreign keys cascade delete on case removal
- Indexes on all case_id foreign keys for performance
- Default case created on first run if none exists

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

### Component Structure

**Page Layout** (app/page.tsx):
- Tabbed interface with conditional Baserow tab (based on settings)
- Each tab wraps a component: ChatTab, EvidenceTab, InsightsTab (reused for insights/arguments/todos)
- Uses Radix UI tabs with icons from lucide-react

**Reusable Pattern**:
- InsightsTab component handles three categories by accepting `category` prop: 'insight', 'argument', 'todo'
- All tabs receive `caseId` prop for multi-case support (though UI currently shows only first case)

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
