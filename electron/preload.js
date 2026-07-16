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
  showBinaryDialog: (options) =>
    ipcRenderer.invoke('echo-mirage-save:show-binary-dialog', options),
});

contextBridge.exposeInMainWorld('echoMirageMediaProtection', {
  getStatus: () => ipcRenderer.invoke('echo-mirage-media-protection:status'),
  setEnabled: (enabled) => ipcRenderer.invoke('echo-mirage-media-protection:set-enabled', enabled),
  subscribe: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('echo-mirage-media-protection:status-changed', listener);
    return () => ipcRenderer.removeListener('echo-mirage-media-protection:status-changed', listener);
  },
});

contextBridge.exposeInMainWorld('echoMirageSilentMode', {
  getEnabled: () => ipcRenderer.invoke('echo:get-silent-mode'),
  setEnabled: (enabled) => ipcRenderer.invoke('echo:set-silent-mode', Boolean(enabled)),
  hideToTray: () => ipcRenderer.invoke('echo:hide-to-tray'),
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('echo:silent-mode-changed', listener);
    return () => ipcRenderer.removeListener('echo:silent-mode-changed', listener);
  },
});

contextBridge.exposeInMainWorld('echoMirageAppUpdate', {
  getVersion: () => ipcRenderer.invoke('echo:app-update:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('echo:app-update:check'),
  quitAndInstall: () => ipcRenderer.invoke('echo:app-update:quit-and-install'),
  subscribe: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('echo:app-update:event', listener);
    return () => ipcRenderer.removeListener('echo:app-update:event', listener);
  },
});

contextBridge.exposeInMainWorld('echoMirageProviderEnv', {
  getStatus: () => ipcRenderer.invoke('echo:provider-env:status'),
  write: (vars) => ipcRenderer.invoke('echo:provider-env:write', vars || {}),
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
  writeBinaryFile: (filePath, base64) =>
    ipcRenderer.invoke('echo-mirage-open:write-binary-file', { filePath, base64 }),
  stageGifDrag: (options) => ipcRenderer.invoke('echo-mirage-open:stage-gif-drag', options),
  startFileDrag: (filePath) =>
    ipcRenderer.send('echo-mirage-open:start-file-drag', { filePath: String(filePath || '') }),
  openPath: (filePath) => ipcRenderer.invoke('echo-mirage-open:open-path', { filePath }),
});
