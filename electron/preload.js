const { contextBridge, clipboard, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('echoMirageClipboard', {
  readText: () => clipboard.readText(),
  writeText: (text) => clipboard.writeText(String(text || '')),
});

contextBridge.exposeInMainWorld('echoMirageBrowser', {
  navigate: (url) => ipcRenderer.invoke('echo-mirage-browser:navigate', String(url || 'about:blank')),
  snapshot: () => ipcRenderer.invoke('echo-mirage-browser:snapshot'),
  reload: () => ipcRenderer.invoke('echo-mirage-browser:reload'),
  back: () => ipcRenderer.invoke('echo-mirage-browser:back'),
  forward: () => ipcRenderer.invoke('echo-mirage-browser:forward'),
});
