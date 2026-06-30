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
        fetchWindowIcons: false,
      });

      if (!sources.length) {
        throw new Error("desktopCapturer returned no screen sources.");
      }

      const displayId = String(display.id);
      const candidates = [
        sources.find((entry) => entry.display_id === displayId),
        sources.find((entry) => String(entry.display_id) === displayId),
        sources.find((entry) => entry.name.toLowerCase().includes("entire screen")),
        sources.find((entry) => entry.name.toLowerCase().includes("screen 1")),
        ...sources.filter((entry) => entry.id.startsWith("screen:")),
        ...sources,
      ];

      const seen = new Set();
      for (const source of candidates) {
        if (!source || seen.has(source.id)) continue;
        seen.add(source.id);

        const thumbnail = source.thumbnail;
        if (thumbnail.isEmpty()) continue;

        const size = thumbnail.getSize();
        const pngBuffer = thumbnail.toPNG();
        if (!pngBuffer.length || !size.width || !size.height) continue;

        return {
          pngBase64: pngBuffer.toString("base64"),
          width: size.width,
          height: size.height,
          pngBuffer,
          captureSource: "desktopCapturer",
        };
      }

      throw new Error(
        `desktopCapturer returned empty thumbnails for ${sources.length} screen source(s).`,
      );
    },
  };
}
