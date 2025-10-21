# Legal Assistant - Desktop Application

A 100% local desktop application for legal case analysis and narrative management.

## Features

✅ **100% Local Storage**

- SQLite database for case data
- Local file storage for evidence
- JSON-based vector storage
- No cloud dependencies

✅ **Tabbed Interface**

- 💬 Chat - Conversational AI interface
- 📁 Evidence Manager - Upload plaintiff & opposition documents
- 💡 Key Insights - Save important points
- ⚖️ Arguments - Store legal reasoning
- ✅ To-Do - Task management
- 🗄️ Baserow - Optional database integration
- ⚙️ Settings - Configure API keys

✅ **Interactive Memory**

- "Save that" command to store insights
- Manual save buttons on AI responses
- Searchable saved items

✅ **Optional Integrations**

- OpenAI API for AI analysis
- Baserow for structured data (requires Docker)

---

## Installation & Setup

### Prerequisites

- Node.js 18+ and Yarn installed
- (Optional) Docker Desktop for Baserow
- (Optional) OpenAI API key

### Development Mode

1. **Navigate to project directory:**

   ```bash
   cd /home/ubuntu/legal_assistant_desktop
   ```

2. **Start the development server:**

   ```bash
   yarn dev
   ```

3. **The app will open automatically in a desktop window**

### Making Changes

All source code is in these directories:

```
/home/ubuntu/legal_assistant_desktop/
├── app/              # Pages and API routes
├── components/       # UI components
├── lib/              # Database and utilities
├── electron/         # Electron main process
└── data/             # Your local data (auto-created)
```

**To modify the app:**

1. Edit any file
2. Save it
3. The app hot-reloads automatically

**To rebuild after changes:**

```bash
yarn build
```

---

## Building Windows Executable

### Create Installer (.exe)

```bash
yarn package
```

This creates:

- `release/` folder with `Legal Assistant Setup.exe`
- Double-click to install on any Windows PC

---

## Configuration

### OpenAI API Key

1. Go to Settings tab
2. Enter your OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))
3. Click "Save Settings"

### Baserow Integration (Optional)

**Prerequisites:**

- Docker Desktop must be running
- Baserow running on port 8000 (or custom port)

**Setup:**

1. Start Baserow in Docker
2. Go to Settings tab
3. Enable "Baserow Integration" toggle
4. Enter Baserow URL (default: http://localhost:8000)
5. Enter your Baserow API token
6. Click "Test Connection"
7. If successful, Baserow tab will appear

**Port Conflicts:**
If Windows services hijack port 8000:

1. Change Baserow port in Docker settings
2. Update URL in app Settings
3. Test connection again

---

## Data Storage

All data is stored locally in:

```
/home/ubuntu/legal_assistant_desktop/data/
├── legal_assistant.db    # SQLite database
├── evidence/             # Uploaded files
└── vectors/              # Document embeddings
```

**Backup your data:**
Simply copy the entire `data/` folder

---

## How to Use

### 1. Chat Tab

- Ask questions about your case
- AI analyzes uploaded evidence
- Say "save that" to store insights
- Click "Save as Insight" or "Save as Argument" buttons

### 2. Evidence Manager

- Upload **Plaintiff Evidence** (your documents)
- Upload **Opposition Evidence** (opposing party docs)
- AI searches these when answering questions
- Supports: PDF, DOC, DOCX, TXT

### 3. Key Insights / Arguments / To-Do

- Manually add items
- Auto-saved from chat conversations
- Check off completed to-do items
- Search and organize

### 4. Baserow (when enabled)

- Structured tables for case facts
- Timeline management
- Witness tracking
- Syncs with AI analysis

---

## Updating the App

**To get new features:**

1. Come back to this chat
2. Tell me what you want to add/change
3. I'll modify the code
4. Run `yarn build` to rebuild
5. Run `yarn package` to create new .exe

---

## Troubleshooting

### App won't start

```bash
rm -rf node_modules .next
yarn install
yarn dev
```

### Build fails

```bash
yarn tsc --noEmit
# Fix any TypeScript errors shown
```

### Database errors

- Delete `data/legal_assistant.db`
- Restart app (it will recreate)

### Baserow connection fails

1. Ensure Docker Desktop is running
2. Check Baserow is accessible at the URL
3. Verify API token is correct
4. Check Windows firewall isn't blocking

---

## Architecture

**Frontend:**

- Next.js 14 + React 18
- Tailwind CSS for styling
- Radix UI components

**Desktop:**

- Electron 28
- Local file system access
- Native window management

**Storage:**

- SQLite (better-sqlite3)
- JSON-based vector storage
- Local file storage

**AI (when configured):**

- OpenAI GPT-4 for analysis
- Vector search for evidence retrieval

---

## Future Enhancements

Want to add:

- Full ChromaDB with embeddings
- Multi-case management UI
- Export to PDF/Word
- Timeline visualization
- Document OCR
- Advanced search

Just ask in the chat!

---

## License & Privacy

- Your data never leaves your computer
- No cloud storage or telemetry
- API calls only when you configure OpenAI
- Open source architecture

---

---

## 🔧 Project Setup Progress

This section summarizes the current repository initialization status  
(see `.project_todo.md` for detailed tracking).

| Task                    | Status         |
| ----------------------- | -------------- |
| 🏗️ Repository Creation  | ✅ Completed   |
| 📘 README Update        | ⏳ Pending     |
| 🧹 .gitignore Setup     | ✅ Completed   |
| 💾 Initial Git Commit   | 🔄 In Progress |
| 🚀 GitHub Push          | ⏳ Pending     |
| 🔒 Branch Protection    | ⏳ Pending     |
| 💬 Issues & Discussions | ⏳ Pending     |

---

**Need help? Come back to the chat and ask!** 🚀
