const { contextBridge, clipboard } = require('electron');

contextBridge.exposeInMainWorld('echoMirageClipboard', {
  readText: () => clipboard.readText(),
  writeText: (text) => clipboard.writeText(String(text || '')),
});
