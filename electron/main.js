require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let store;
let mainWindow;
let nextServer;
let isDev;

async function startNextServer() {
  if (!isDev) {
    const next = require("next");
    const nextApp = next({
      dev: false,
      dir: path.join(__dirname, ".."),
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    const http = require("http");
    nextServer = http.createServer((req, res) => {
      handle(req, res);
    });

    return new Promise((resolve) => {
      nextServer.listen(3004, () => {
        console.log("Next.js server started on port 3004");
        resolve();
      });
    });
  }
}

async function createWindow() {
  // Dynamically import ES modules
  const electronIsDev = await import("electron-is-dev");
  isDev = electronIsDev.default;

  const ElectronStore = await import("electron-store");
  store = new ElectronStore.default();

  if (!isDev) {
    await startNextServer();
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../public/icon.ico"),
  });

  const startURL = "http://localhost:3004";

  mainWindow.loadURL(startURL);

  // Developer tools no longer open automatically on launch

  // Enable right-click context menu with spell check
  mainWindow.webContents.on("context-menu", (event, params) => {
    const { Menu, MenuItem } = require("electron");
    const menu = new Menu();

    // Add spell check suggestions if available
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        })
      );
    }

    // Add separator if there are suggestions
    if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
      menu.append(new MenuItem({ type: "separator" }));
    }

    // Add "Add to dictionary" if word is misspelled
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: "Add to Dictionary",
          click: () =>
            mainWindow.webContents.session.addWordToSpellCheckerDictionary(
              params.misspelledWord
            ),
        })
      );
      menu.append(new MenuItem({ type: "separator" }));
    }

    // Standard editing commands
    menu.append(
      new MenuItem({ label: "Cut", role: "cut", enabled: params.editFlags.canCut })
    );
    menu.append(
      new MenuItem({ label: "Copy", role: "copy", enabled: params.editFlags.canCopy })
    );
    menu.append(
      new MenuItem({ label: "Paste", role: "paste", enabled: params.editFlags.canPaste })
    );

    // Show menu at cursor position
    menu.popup();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App lifecycle
app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (nextServer) {
    nextServer.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for settings
ipcMain.handle("get-setting", async (event, key) => {
  return store.get(key);
});

ipcMain.handle("set-setting", async (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle("get-app-path", async () => {
  return app.getPath("userData");
});

// Chat save/load handlers
const fs = require("fs");
const chatsDir = path.join(app.getPath("userData"), "chats");

if (!fs.existsSync(chatsDir)) {
  fs.mkdirSync(chatsDir, { recursive: true });
}

ipcMain.handle("save-chat", async (event, data) => {
  try {
    const fileName = data?.name
      ? `${data.name.replace(/[^a-z0-9_-]/gi, "_")}.json`
      : `chat_${Date.now()}.json`;
    const filePath = path.join(chatsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true, path: filePath };
  } catch (err) {
    console.error("Failed to save chat", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-saved-chats", async () => {
  try {
    const files = fs.readdirSync(chatsDir).filter((f) => f.endsWith(".json"));
    return files.map((name) => ({
      name,
      path: path.join(chatsDir, name),
    }));
  } catch (err) {
    console.error("Failed to list chats", err);
    return [];
  }
});

ipcMain.handle("load-chat", async (event, filename) => {
  try {
    const fullPath = path.join(chatsDir, filename);
    const content = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to load chat", err);
    return null;
  }
});

ipcMain.handle("archive-chat", async (event, filename) => {
  try {
    const archiveDir = path.join(chatsDir, "archive");
    if (!fs.existsSync(archiveDir))
      fs.mkdirSync(archiveDir, { recursive: true });
    const sourcePath = path.join(chatsDir, filename);
    const destPath = path.join(archiveDir, filename);
    fs.renameSync(sourcePath, destPath);
    return { success: true, path: destPath };
  } catch (err) {
    console.error("Failed to archive chat", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("open-file", async (event, filepath) => {
  try {
    const { shell } = require("electron");
    await shell.openPath(filepath);
    return { success: true };
  } catch (err) {
    console.error("Failed to open file", err);
    return { success: false, error: err.message };
  }
});
