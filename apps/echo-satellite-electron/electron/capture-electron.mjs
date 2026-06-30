/**
 * macOS full-screen capture via Chromium desktopCapturer (includes other app windows).
 * @param {{ desktopCapturer: import('electron').DesktopCapturer, screen: import('electron').Screen }} electron
 */
export function createElectronScreenCapture(electron) {
  return {
    async captureScreen() {
      const display = electron.screen.getPrimaryDisplay();
      const scaleFactor = display.scaleFactor || 1;
      const width = Math.floor(display.size.width * scaleFactor);
      const height = Math.floor(display.size.height * scaleFactor);

      const sources = await electron.desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width, height },
      });

      const displayId = String(display.id);
      let source =
        sources.find((entry) => entry.display_id === displayId) ??
        sources.find((entry) => entry.id.startsWith("screen")) ??
        sources[0];

      if (!source) {
        throw new Error("No screen source from desktopCapturer.");
      }

      const thumbnail = source.thumbnail;
      if (thumbnail.isEmpty()) {
        throw new Error("desktopCapturer returned an empty thumbnail.");
      }

      const size = thumbnail.getSize();
      const pngBuffer = thumbnail.toPNG();
      if (!pngBuffer.length) {
        throw new Error("desktopCapturer PNG encode failed.");
      }

      return {
        pngBase64: pngBuffer.toString("base64"),
        width: size.width,
        height: size.height,
        pngBuffer,
        captureSource: "desktopCapturer",
      };
    },
  };
}
