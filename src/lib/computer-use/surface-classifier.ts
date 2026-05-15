export type SurfaceType =
  | "chatgpt"
  | "opencode"
  | "codex"
  | "vscode"
  | "terminal"
  | "browser"
  | "unknown";

export interface SurfaceClassification {
  surface: SurfaceType;
  confidence: "high" | "medium" | "low";
  reason: string;
  rawTitle?: string;
}

interface SurfacePattern {
  surface: SurfaceType;
  patterns: RegExp[];
  keywords: string[];
  reason: string;
}

const SURFACE_PATTERNS: SurfacePattern[] = [
  {
    surface: "chatgpt",
    patterns: [
      /chatgpt/i,
      /chat\.openai\.com/i,
      /openai.*chat/i,
    ],
    keywords: ["chatgpt", "chat gpt", "new chat", "share a chat"],
    reason: "OpenAI ChatGPT interface detected",
  },
  {
    surface: "opencode",
    patterns: [
      /opencode/i,
      /open-code/i,
      /anomalyco.*opencode/i,
      /opencode\.ai/i,
    ],
    keywords: ["opencode", "open-code"],
    reason: "OpenCode agent interface detected",
  },
  {
    surface: "codex",
    patterns: [
      /github.*copilot/i,
      /claude.*code/i,
      /cursor.*ai/i,
      /cursor\s+-/i,
      /cursor\s+editor/i,
      / Windsurf/i,
      /replit/i,
    ],
    keywords: ["copilot", "cursor", "windsurf", "replit", "codex"],
    reason: "AI coding assistant detected",
  },
  {
    surface: "vscode",
    patterns: [
      /visual\s*studio\s*code/i,
      /vs\s*code/i,
      /vscode/i,
      /code.*-.*insiders/i,
      /\.code$/i,
    ],
    keywords: ["visual studio", "vscode", "vs code"],
    reason: "Visual Studio Code detected",
  },
  {
    surface: "terminal",
    patterns: [
      /powershell/i,
      /cmd\.exe/i,
      /iterm/i,
      /wsl/i,
      /ubuntu/i,
      /bash/i,
      /zsh/i,
      /fish\s*shell/i,
      /alacritty/i,
      /windows\s*terminal/i,
      /wt\.exe/i,
      /conhost/i,
      /terminal/i,
    ],
    keywords: ["powershell", "cmd", "bash", "zsh"],
    reason: "Terminal session detected",
  },
  {
    surface: "browser",
    patterns: [
      /google\s*chrome/i,
      /chrome/i,
      /firefox/i,
      /safari/i,
      /edge/i,
      /brave/i,
      /opera/i,
      /electron/i,
      /chromium/i,
    ],
    keywords: ["chrome", "firefox", "safari", "edge", "browser"],
    reason: "Web browser detected",
  },
];

export function classifyWindowTitle(title: string): SurfaceClassification {
  if (!title || typeof title !== "string") {
    return { surface: "unknown", confidence: "low", reason: "No window title available" };
  }

  const lowerTitle = title.toLowerCase();

  for (const entry of SURFACE_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(title)) {
        return {
          surface: entry.surface,
          confidence: "high",
          reason: entry.reason,
          rawTitle: title,
        };
      }
    }

    for (const keyword of entry.keywords) {
      if (lowerTitle.includes(keyword)) {
        return {
          surface: entry.surface,
          confidence: "medium",
          reason: entry.reason,
          rawTitle: title,
        };
      }
    }
  }

  return { surface: "unknown", confidence: "low", reason: "No known surface pattern matched", rawTitle: title };
}

export function getSurfaceEmoji(surface: SurfaceType): string {
  switch (surface) {
    case "chatgpt": return "ChatGPT";
    case "opencode": return "OpenCode";
    case "codex": return "Codex";
    case "vscode": return "VS Code";
    case "terminal": return "Terminal";
    case "browser": return "Browser";
    default: return "Unknown";
  }
}

export function formatSurfaceResponse(classification: SurfaceClassification): string {
  const { surface, confidence, reason, rawTitle } = classification;
  const name = getSurfaceEmoji(surface);

  if (surface === "unknown") {
    return `I don't recognize this surface.${rawTitle ? ` Window: "${rawTitle}"` : ""}`;
  }

  let base = `I see ${name} active.`;
  if (confidence === "medium") {
    base = `I see what may be ${name}.`;
  }
  if (rawTitle) {
    base += ` Window: "${rawTitle}"`;
  }
  return base;
}

export function formatSurfaceStatusLine(classification: SurfaceClassification): string {
  const { surface, confidence } = classification;
  const name = getSurfaceEmoji(surface);
  return `${name} [${confidence}]`;
}

export function getAllSurfaceTypes(): SurfaceType[] {
  return ["chatgpt", "opencode", "codex", "vscode", "terminal", "browser", "unknown"];
}