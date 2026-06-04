const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('echoMirageClipboard', {
  readText: () => ipcRenderer.invoke('echo-mirage-clipboard:read-text'),
  writeText: (text) => ipcRenderer.invoke('echo-mirage-clipboard:write-text', String(text || '')),
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

contextBridge.exposeInMainWorld('echoMirageOpen', {
  pickConvertDocument: () => ipcRenderer.invoke('echo-mirage-open:pick-convert-document'),
  pickOperatorFolder: () => ipcRenderer.invoke('echo-mirage-open:pick-operator-folder'),
  listOperatorFolder: (rootPath, relativePath, pathPrefix) =>
    ipcRenderer.invoke('echo-mirage-open:list-operator-folder', { rootPath, relativePath, pathPrefix }),
  readOperatorFile: (rootPath, logicalPath) =>
    ipcRenderer.invoke('echo-mirage-open:read-operator-file', { rootPath, logicalPath }),
  writeOperatorFile: (rootPath, logicalPath, content) =>
    ipcRenderer.invoke('echo-mirage-open:write-operator-file', { rootPath, logicalPath, content }),
  openPath: (filePath) => ipcRenderer.invoke('echo-mirage-open:open-path', { filePath }),
});
