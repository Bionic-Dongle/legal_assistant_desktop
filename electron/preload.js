const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSetting: (key) => ipcRenderer.invoke("get-setting", key),
  setSetting: (key, value) => ipcRenderer.invoke("set-setting", key, value),
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
  saveChat: (data) => ipcRenderer.invoke("save-chat", data),
  getSavedChats: () => ipcRenderer.invoke("get-saved-chats"),
  loadChat: (filename) => ipcRenderer.invoke("load-chat", filename),
  archiveChat: (filename) => ipcRenderer.invoke("archive-chat", filename),
  openFile: (filepath) => ipcRenderer.invoke("open-file", filepath),
});

contextBridge.exposeInMainWorld("electron", {
  openFile: (filepath) => ipcRenderer.invoke("open-file", filepath),
});
