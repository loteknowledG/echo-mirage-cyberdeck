/** Shared parse rules for sync-oneline-art-gist.mjs (keep in sync with src/lib/oneline-art.ts). */
export const ONELINE_ART_MAX_RAW_LINE = 482;

function isIntroLine(line) {
  return /^collection of emojis/i.test(line) || /^# collection of one line/i.test(line);
}

export function isExcludedOnelineArt(line) {
  if (/\uFE0F/.test(line)) return true;
  if (isIntroLine(line)) return true;

  const withoutDescription = line.replace(/\s+[a-zA-Z][a-zA-Z\s.'’-]*$/, "").trim();
  const core = withoutDescription.replace(/\s/g, "");
  if (core && /^\p{Extended_Pictographic}+$/u.test(core)) return true;

  if (/[\\_|()[\]{}<>^~=\-*#\/]/.test(line)) return false;

  const compact = line.replace(/\s+/g, "");
  if (compact.length <= 2 && /\p{Extended_Pictographic}/u.test(compact)) return true;

  return false;
}

export function parseOnelineArtText(text, maxRawLine = ONELINE_ART_MAX_RAW_LINE) {
  const rawLines = text.split(/\r?\n/);
  const limit = Math.min(rawLines.length, maxRawLine);
  const lines = [];

  for (let i = 0; i < limit; i++) {
    const line = rawLines[i]?.trim() ?? "";
    if (!line || line.startsWith("#")) continue;
    if (isExcludedOnelineArt(line)) continue;
    lines.push(line);
  }

  return lines;
}
