const { contextBridge, clipboard, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('echoMirageClipboard', {
  readText: () => clipboard.readText(),
  writeText: (text) => clipboard.writeText(String(text || '')),
});

contextBridge.exposeInMainWorld('echoMirageBrowser', {
  navigate: (url) => ipcRenderer.invoke('echo-mirage-browser:navigate', String(url || 'about:blank')),
  click: (selector) => ipcRenderer.invoke('echo-mirage-browser:click', String(selector || '')),
  type: (selector, value) =>
    ipcRenderer.invoke('echo-mirage-browser:type', String(selector || ''), String(value || '')),
  submit: (selector) => ipcRenderer.invoke('echo-mirage-browser:submit', String(selector || '')),
  snapshot: () => ipcRenderer.invoke('echo-mirage-browser:snapshot'),
  reload: () => ipcRenderer.invoke('echo-mirage-browser:reload'),
  back: () => ipcRenderer.invoke('echo-mirage-browser:back'),
  forward: () => ipcRenderer.invoke('echo-mirage-browser:forward'),
});

contextBridge.exposeInMainWorld('echoMirageComputerUse', {
  runAction: (action) => ipcRenderer.invoke('computer-use:run-action', action),
  isAvailable: () => true,
});

contextBridge.exposeInMainWorld('echoMirageSave', {
  showDialog: (options) => ipcRenderer.invoke('echo-mirage-save:show-dialog', options),
});