
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let nextServer;

async function startNextServer() {
  if (!isDev) {
    const next = require('next');
    const nextApp = next({
      dev: false,
      dir: path.join(__dirname, '..'),
    });
    
    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();
    
    const http = require('http');
    nextServer = http.createServer((req, res) => {
      handle(req, res);
    });
    
    return new Promise((resolve) => {
      nextServer.listen(3000, () => {
        console.log('Next.js server started on port 3000');
        resolve();
      });
    });
  }
}

async function createWindow() {
  if (!isDev) {
    await startNextServer();
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  const startURL = 'http://localhost:3000';

  mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for settings
ipcMain.handle('get-setting', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-setting', async (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('get-app-path', async () => {
  return app.getPath('userData');
});
