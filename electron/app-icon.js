const fs = require('fs');
const path = require('path');

function resolveAppPublicDir(app, dirname) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'public');
  }
  return path.join(path.resolve(dirname, '..'), 'public');
}

function resolveAppIconPath(app, dirname) {
  const publicDir = resolveAppPublicDir(app, dirname);
  const candidates = ['icon.ico', 'icon-512.png', 'icon-192.png'];
  for (const name of candidates) {
    const candidate = path.join(publicDir, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function loadAppNativeIcon(app, nativeImage, dirname) {
  const iconPath = resolveAppIconPath(app, dirname);
  if (!iconPath) {
    return nativeImage.createEmpty();
  }
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    return nativeImage.createEmpty();
  }
  if (process.platform === 'win32') {
    return image.resize({ width: 256, height: 256 });
  }
  return image;
}

function loadTrayNativeIcon(app, nativeImage, dirname) {
  const image = loadAppNativeIcon(app, nativeImage, dirname);
  if (image.isEmpty()) {
    return image;
  }
  if (process.platform === 'win32') {
    return image.resize({ width: 32, height: 32 });
  }
  return image.resize({ width: 22, height: 22 });
}

module.exports = {
  resolveAppIconPath,
  loadAppNativeIcon,
  loadTrayNativeIcon,
};
