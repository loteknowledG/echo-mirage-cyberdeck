import type { BoxChars } from "@/lib/muthur-ascii-skill/styles";

export function clampWidth(width: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(width)) return fallback;
  return Math.max(min, Math.min(max, Math.round(width)));
}

export function visibleLength(text: string): number {
  return [...text].length;
}

export function pad(
  text: string,
  width: number,
  align: "left" | "center" | "right" = "left",
): string {
  const chars = [...text];
  const len = chars.length;
  if (len >= width) return chars.slice(0, width).join("");
  const padLen = width - len;
  if (align === "right") return " ".repeat(padLen) + text;
  if (align === "center") {
    const left = Math.floor(padLen / 2);
    return " ".repeat(left) + text + " ".repeat(padLen - left);
  }
  return text + " ".repeat(padLen);
}

export function center(text: string, width: number): string {
  return pad(text, width, "center");
}

export function wrap(text: string, width: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (width < 8) return [normalized.slice(0, width)];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (visibleLength(next) <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (visibleLength(word) > width) {
      let chunk = "";
      for (const ch of word) {
        const attempt = chunk + ch;
        if (visibleLength(attempt) > width) {
          if (chunk) lines.push(chunk);
          chunk = ch;
        } else {
          chunk = attempt;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function line(width: number, char = "─"): string {
  if (width <= 0) return "";
  return char.repeat(width);
}

export function box(contentLines: string[], width: number, chars: BoxChars): string[] {
  const innerWidth = Math.max(0, width - 2);
  const top = `${chars.tl}${chars.h.repeat(innerWidth)}${chars.tr}`;
  const bottom = `${chars.bl}${chars.h.repeat(innerWidth)}${chars.br}`;
  const body = contentLines.map((row) => {
    const inner = pad(row, innerWidth, "left");
    return `${chars.v}${inner}${chars.v}`;
  });
  return [top, ...body, bottom];
}

export function columns(
  leftLines: string[],
  rightLines: string[],
  width: number,
  gutter = 2,
): string[] {
  const half = Math.floor((width - gutter) / 2);
  const rightWidth = width - gutter - half;
  const count = Math.max(leftLines.length, rightLines.length);
  const rows: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const left = pad(leftLines[i] ?? "", half, "left");
    const right = pad(rightLines[i] ?? "", rightWidth, "left");
    rows.push(`${left}${" ".repeat(gutter)}${right}`);
  }
  return rows;
}

export function wave(text: string, width: number): string {
  const base = center(text, width);
  const chars = [...base];
  for (let i = 2; i < chars.length - 2; i += 4) {
    if (chars[i] === " ") continue;
    chars[i] = i % 8 === 0 ? "~" : chars[i];
  }
  return chars.join("");
}

export function cable(width: number): string {
  const pattern = "──~~──";
  let out = "";
  while (visibleLength(out) < width) out += pattern;
  return out.slice(0, width);
}

export function glitch(text: string, intensity = 0.15): string {
  const swaps: Record<string, string> = {
    O: "0",
    I: "1",
    E: "3",
    A: "4",
    S: "5",
    T: "7",
    "-": "─",
    "/": "╱",
    "\\": "╲",
  };
  return [...text]
    .map((ch, index) => {
      if (ch === " " || Math.random() > intensity) return ch;
      return swaps[ch] ?? (index % 5 === 0 ? "▌" : ch);
    })
    .join("");
}

/** Deterministic glitch for stable renders (no Math.random). */
export function glitchStable(text: string): string {
  const swaps: Record<string, string> = {
    O: "0",
    I: "1",
    E: "3",
    A: "4",
    S: "5",
    T: "7",
  };
  return [...text]
    .map((ch, index) => (index % 7 === 3 ? (swaps[ch] ?? ch) : ch))
    .join("");
}

export function scanline(width: number): string {
  const fill = "░".repeat(Math.max(0, width - 4));
  return `▒▒${fill}▒▒`.slice(0, width);
}

export function insetLine(text: string, innerWidth: number, prefix: string): string {
  return prefix + pad(text, Math.max(0, innerWidth - visibleLength(prefix)), "left");
}
