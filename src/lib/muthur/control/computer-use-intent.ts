import type { ComputerUseMission, PiControlCapability } from "@/lib/muthur/control/pi-control-lease-types";

const DEFAULT_CAPABILITIES: PiControlCapability[] = [
  "mouse",
  "keyboard",
  "screen",
  "scroll",
];

const COMPUTER_USE_PATTERNS: Array<{
  pattern: RegExp;
  task: (match: RegExpMatchArray, message: string) => string;
}> = [
  {
    // Glyph-pane art ("draw a cat") is NOT desktop computer use — require explicit desktop/app targets.
    pattern:
      /\b(?:draw|paint|sketch|illustrate)\b.+\b(?:ms\s*paint|microsoft\s*paint|desktop|on\s+screen|notepad|photoshop|illustrator|gimp)\b/i,
    task: (_match, message) => {
      const subject = message.match(
        /\b(?:draw|paint|sketch)\s+(?:me\s+)?(?:a\s+)?(.+?)(?:\s+on|\s+in|\s+using)[.!?]?$/i,
      )?.[1];
      return subject ? `Draw ${titleCase(subject.trim())}` : "Desktop Draw";
    },
  },
  {
    pattern: /\b(?:open|launch|start)\b.+\b(?:browser|chrome|firefox|edge|safari)\b/i,
    task: () => "Open Browser",
  },
  {
    pattern: /\b(?:navigate|go to|visit)\b.+\b(?:website|site|url|page)\b/i,
    task: () => "Navigate Website",
  },
  {
    pattern: /\b(?:upload|attach)\b.+\b(?:document|file)\b/i,
    task: () => "Upload Document",
  },
  {
    pattern: /\b(?:configure|set up|install)\b.+\b(?:software|app|application|program)\b/i,
    task: () => "Configure Software",
  },
  {
    pattern: /\b(?:click|type|press|scroll|move)\b.+\b(?:mouse|keyboard|screen|desktop|window)\b/i,
    task: () => "Desktop Interaction",
  },
  {
    pattern: /\b(?:computer use|desktop action|take control|use the mouse|use the keyboard)\b/i,
    task: () => "Computer Use Mission",
  },
];

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function slugifyTask(task: string): string {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Detect missions that require Pi computer-use embodiment (Commander + explicit desktop intent). */
export function detectComputerUseMission(message: string): ComputerUseMission | null {
  const text = message.trim();
  if (!text) return null;

  for (const entry of COMPUTER_USE_PATTERNS) {
    const match = text.match(entry.pattern);
    if (!match) continue;
    const task = entry.task(match, text).trim() || "Computer Use Mission";
    return {
      task,
      taskSlug: slugifyTask(task),
      reason: "Computer use required to complete mission.",
      capabilities: DEFAULT_CAPABILITIES,
      missionText: text,
    };
  }

  return null;
}
