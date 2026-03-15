# LegalMind — Current State
_Last updated: 2026-03-08 (session 4)_

---

## What Works Right Now

- **Chat** — OpenAI GPT-4o-mini, RAG context from evidence, last 6 messages of history
- **Cowork import queue** — the main evidence ingestion path (see COWORK.md for the prompt)
- **Evidence tab** — shows imported evidence, blue banner when queue has waiting items
- **Narrative Construction** — TipTap editor, plot points, sub-narratives, narrative chat
- **Timeline** — threads, zoom levels, DnD, dot mode with tooltips
- **Chat Repository** — save/load/archive chats, message count badge on each row
- **Insights / Arguments / Todos** — saved, vectorised, retrieved by relevance to current question
- **Settings** — OpenAI API key, system prompts, env sync

---

## What Was Fixed This Session (2026-03-05)

1. **Runtime error "Element type is invalid"** — `DocumentViewerModal.tsx` was calling
   `new DiffMatchPatch()` at module level, which crashes during Next.js SSR and makes
   the module's exports undefined. Fixed with a lazy singleton `getDmp()` function.
   Also deleted `.next` cache to clear stale compiled output.

2. **Message count badge** — Chat Repository rows now show how many messages each
   saved chat contains, so you can see at a glance which are empty vs populated.

3. **Cowork import queue** — Built the LegalMind side of the Cowork email pipeline:
   - `data/import-queue/` folder — Cowork writes here
   - `app/api/evidence/import-queue/route.ts` — reads queue, ingests to SQLite + vector store
   - `components/ImportQueuePanel.tsx` — blue banner in Evidence tab when emails are waiting
   - One-click import, dedup automatic, processed items archived

---

## What Was Fixed This Session (2026-03-07)

4. **PDF and DOCX text extraction** — Previously, all files were decoded as UTF-8 text
   in the browser, which produces garbage for binary formats (PDF, Word). Fixed:
   - Created `lib/extract.ts` — uses `pdf-parse` for PDFs, `mammoth` for DOCX/DOC,
     plain UTF-8 for text files. Handles scanned PDFs gracefully with a message.
   - Updated `app/api/evidence/route.ts` — calls `extractText()` instead of raw buffer decode
   - Updated `components/EvidenceTab.tsx` — PDFs/Word docs now send empty extractedText
     to the server (server does the real extraction), plain text files still read in browser
   - Fixed TypeScript error in `lib/extract.ts` — pdf-parse import handled with `as any`
   - TypeScript: `yarn tsc --noEmit` passes clean ✅

5. **Insights and arguments — relevance retrieval** — Previously, every single saved
   insight and argument was sent to the AI on every message (no limit, growing forever).
   Fixed:
   - Insights and arguments are now indexed in the vector store when saved
     (`app/api/insights/route.ts`)
   - They are retrieved by relevance to the current question, not just grabbed in bulk
     (`lib/context.ts`)
   - Each source type is labelled separately so the AI knows what weight to give it:
     - Evidence = what the documents actually say
     - Working Insights = your interpretation (treat as hypothesis)
     - Legal Arguments = positions under development
   - Deleted insights/arguments are also removed from the vector store
   - Added `removeDocuments()` to `lib/chroma.ts` to support this

6. **Cowork import quality** — Emails imported via Cowork were getting weaker text
   search than files uploaded directly. Fixed:
   - `app/api/evidence/import-queue/route.ts` now generates OpenAI embeddings for every
     imported item, same as the direct upload path
   - `document_type` now passed through from the Cowork JSON (was hardcoded to
     "email communication" even for images and GDrive docs)

7. **GDrive download folder created** — The two folders for downloading discovery
   documents are ready:
   - `data/gdrive-import/plaintiff/` — for your side
   - `data/gdrive-import/opposition/` — for Yvonne/Troy's side
   - COWORK.md updated with actual paths and download instructions

8. **Cowork prompt expanded** — Now covers the full evidence pipeline:
   - Text message screenshots (verbatim transcription via vision)
   - Property photographs (plain-language description via vision)
   - Email and document screenshots
   - Scanned documents
   - Google Drive documents (both parties, local folder paths specified)
   - Flexible `document_type` field (was hardcoded to "email communication")

---

## Working Agreements Established This Session

These are not code changes — they're how we work together going forward:

1. **Plain English first** — every explanation leads with what it means in plain language, technical detail follows
2. **No ceremony on check-ins** — just get on with the work. Only stop and ask when: there's a real choice between two directions, something is irreversible, or something outside scope needs flagging
3. **"Always allow for session" is useless** — it only applies to that exact operation. Ignore it. The global permissions file now handles Read/Edit/Write automatically
4. **Global permissions fixed** — `C:\Users\chipp\.claude\settings.json` now has the full allow list so approval dialogs for file operations don't appear in any project, any session
5. **Time estimates** — quoted in "minutes of Claude work" not "hours of human developer work"
6. **Playwright regression testing** — added to long-term roadmap. Not next sprint but worth building toward: automated cumulative testing with rollback on regression

---

## What Was Fixed/Built This Session (2026-03-08, sessions 3–4)

9. **OpenRouter support** — Settings now supports OpenRouter as a third AI provider.
   Live model list fetched from OpenRouter API on load (no hardcoded list).
   Custom scrollable Select component handles the long model list cleanly.

10. **Settings rewrite** — Collapsible sections, better ordering: API config first,
    then model selectors, then system prompts, then utilities. All sections start
    collapsed. The "Main Chat Provider" section was incorrectly defaulting to open —
    fixed (`provider: false` in initial state).

11. **System prompt overlay fixed (main chat + timeline)** — If a user-defined system
    prompt was set in Settings, it was replacing the entire base prompt instead of
    layering on top. Fixed in both `app/api/chat/route.ts` and
    `app/api/timeline-chat/route.ts`. User's text now appends under a clearly labelled
    section heading.

12. **AI hallucination fix** — The AI was inventing fake chat history to explain why
    it knew the user's configured name ("you mentioned earlier that I should call you
    chippo"). Root cause: the overlay section was labelled `### User Instructions`,
    making the AI think it came from the conversation. Fixed by changing the label to
    `### Configured Preferences (set by the user in Settings — NOT said in this
    conversation)` in both chat routes.

13. **Auto-Plot Evidence feature** — New ⚡ button in the Narrative Construction toolbar
    opens a review modal that suggests plot points for every piece of imported evidence
    that hasn't been plotted yet.
    - Dated items are pre-selected; undated items are unchecked and ask for a date
    - Each row has editable title, date picker, thread selector, memory_type badge
    - On confirm: creates the plot points then marks evidence as `auto_plotted = 1`
      so they don't show again
    - New files: `app/api/evidence/auto-plot/route.ts`, `components/AutoPlotModal.tsx`
    - `lib/db.ts`: additive migration adds `auto_plotted` column to evidence table

---

## What Was Done This Session (2026-03-14)

14. **Cyberpunk UI reskin — fonts + scanlines + animations applied**
    - `app/layout.tsx` — swapped Inter for Orbitron (headings) + Share Tech Mono (body) via `next/font/google`. Fonts bundle at build time, work offline in the packaged app.
    - `app/globals.css` — added CRT scanline overlay (`body::before` repeating gradient), flicker keyframe (subtle opacity dip every 10s), pulse-glow keyframe (breathing text-shadow), slide-up keyframe (fade-in from below). Body font set to Share Tech Mono, h1/h2/h3 set to Orbitron uppercase.
    - The neon color system, glow utilities, badges etc. were already in place from a prior session — this session wired in the missing pieces.

15. **package.json installer metadata updated**
    - Added `"publish": null` and `"copyright": "Copyright © 2025 Chippo"` to the electron-builder build config.
    - `author` was already "Chippo". Version stays at 1.0.0.

16. **Packaging attempt — blocked, not completed**
    - `yarn package` starts with `next build` (succeeded) then tries to rebuild `better-sqlite3` native module for Electron.
    - Failed with `EPERM: operation not permitted` — the `.node` file was locked because the app was still running.
    - **Fix**: close LegalMind/`yarn dev` first, then run `yarn package`. That's it — no code changes needed.

---

---

## What Was Built This Session (2026-03-15)

17. **Cowork replacement — native scan pipeline**
    - `lib/triage.ts` — AI triage function (OpenAI, structured JSON output) used by all scan routes
    - `app/api/evidence/scan-folders/route.ts` — walks local folders (batch 30), extracts text, runs triage, writes to import queue
    - `app/api/evidence/scan-email/route.ts` — Gmail scanner with date range + sender filter
    - `app/api/evidence/gmail-auth/route.ts` — OAuth2 for Gmail (start/callback/status/disconnect)
    - `app/api/evidence/outlook-auth/route.ts` — OAuth2 for Microsoft Graph / Outlook
    - `app/api/evidence/scan-outlook/route.ts` — Outlook/Hotmail message scanner
    - `components/ScanPanel.tsx` — collapsible UI in Evidence tab: Browse folders, date range dropdown, sender filter, Gmail + Outlook sections with OAuth setup
    - `electron/main.js` + `electron/preload.js` — added `select-folder` and `open-external-url` IPC handlers
    - Scan + import are chained — one button does everything, no separate "Import Now" step needed

18. **Legal reasoning engine — full pipeline**
    - `lib/signals-registry.ts` — 40-signal taxonomy across 7 legal categories
    - `lib/claim-detection-library.ts` — weighted confidence scoring engine, 7 causes of action
    - `lib/doctrinal-frameworks.ts` — static doctrinal framework registry (constructive trust, proprietary estoppel, fiduciary duty, Barnes v Addy, litigation guardian, POA breach, personal costs)
    - `lib/signal-extractor.ts` — extracts signals from evidence text + metadata + document-type heuristics
    - `lib/austlii.ts` — AustLII search + HTML extraction + AI summarisation pipeline
    - `app/api/legal/analyse/route.ts` — full on-demand analysis endpoint (returns claims + frameworks + authorities)
    - `app/api/chat/route.ts` — legal context (detected claims + active frameworks) now injected into every chat system prompt automatically

19. **CaseTheoryPanel sidebar**
    - `components/CaseTheoryPanel.tsx` — collapsible right-side panel in the Chat tab
    - Auto-runs signal extraction on load (fast, no AustLII)
    - Shows detected claims with colour-coded confidence bars (red/amber/cyan)
    - Each claim expands to show triggered signals + all framework elements to establish
    - "Fetch AustLII" button retrieves and displays relevant case law authorities with expandable cards
    - "View on AustLII →" opens the case in the system browser
    - `components/ChatTab.tsx` — restructured to side-by-side layout (chat left, panel right, 320px)
    - Collapse/expand toggle button on the divider

---

## Immediate Next Steps (do these first next session)

### 0. Package the app (do this first — 5 mins)
- Close LegalMind (stop `yarn dev`, close Electron window)
- Run: `yarn package`
- Output: `release/LegalMind-Setup-1.0.0.exe`
- Install it, done

### 1. GDrive evidence run (Cowork is now replaced — use the Scan Folders button)
This is the big ingestion run. Everything is ready — just needs the files on disk.

**Step 1 — Download from Google Drive:**
- Go to Google Drive
- Right-click the plaintiff folder → Download (saves as zip)
- Unzip into: `data/gdrive-import/plaintiff/`
- Repeat for the opposition folder → unzip into: `data/gdrive-import/opposition/`

**Step 2 — Scan into LegalMind (no Cowork needed):**
- Open LegalMind → Evidence tab → Scan panel
- Click Browse for both plaintiff and opposition folders
- Click Import Folders — scans, triages, and ingests in one step
- For email: set date range dropdown + optional sender filter → Import Gmail or Import Outlook

### 2. Check OpenAI API key is current
Go to Settings in LegalMind. If the key is expired, refresh it at platform.openai.com
and paste it in. You'll know it's working if the blue import banner imports without errors.

### 3. After the big run — verify the evidence landed correctly
- Evidence tab should show items labelled plaintiff / opposition / neutral
- Run a test chat question about the property — it should cite specific documents
- Check a few entries to confirm document types are right (not all showing "email communication")

---

## Known Issues / Things to Watch

- **OpenAI key** — may need refreshing, hasn't been confirmed valid recently
- **Embeddings vs keyword search** — OpenAI embeddings are generated and passed to
  `addDocuments()`, but `lib/chroma.ts` stores them in metadata and falls back to
  keyword matching for retrieval. Real cosine similarity search needs a ChromaDB server.
  For now: keyword matching works fine for a document set of this size.
- **Existing insights not yet vectorised** — any insights/arguments saved before this
  session are only in SQLite. They won't appear in relevance retrieval until re-saved.
  Workaround: open each one in the Insights tab, make a trivial edit, re-save.
- **No GDrive content yet** — waiting on the download step (see Next Steps above)
