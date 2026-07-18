import type { CyberdeckPaneKind } from "@/features/cyberdeck/pane-registry";

export type PreviewCardToolOverride = {
  name: string;
  args?: Record<string, unknown>;
  /** PowerFist composer text is injected into this tool argument when the card is pushed. */
  composerArg?: string;
};

export type PreviewCard = {
  type: string;
  title: string;
  purpose: string;
  preview?: {
    kind: "figlet" | "oneline";
    value: string;
  };
  toolOverride?: PreviewCardToolOverride;
  /** Survey triforce deck — routed to Echo Satellite or Mirage hub (not MUTHUR stack). */
  surveyCommand?: string;
};

export type PreviewDeck = {
  name: string;
  badge: string;
  cards: PreviewCard[];
};

export type PreviewDeckWithTarget = PreviewDeck & {
  targetPane: CyberdeckPaneKind;
};

const PREVIEW_DECK_TARGET_BY_NAME: Record<string, CyberdeckPaneKind> = {
  "Execution Deck": "operator",
  "Diagnostics Deck": "diagnostics",
  "Quorum Deck": "db8",
  "Coding Deck": "cadre",
  "Operator Deck": "operator",
  "Filesystem Deck": "document",
  "Gateway Deck": "pi",
  "Stack Deck": "diagnostics",
};

const GLYPH_PREVIEW_DECK_NAMES = new Set([
  "Text",
  "1 Line ASCII",
  "Figlet",
  "Divider",
  "Signal",
  "Banner",
]);

export function resolvePreviewDeckTarget(name: string): CyberdeckPaneKind {
  if (GLYPH_PREVIEW_DECK_NAMES.has(name)) {
    return "glyph-channel";
  }
  return PREVIEW_DECK_TARGET_BY_NAME[name] ?? "operator";
}

export function withPreviewDeckTarget(deck: PreviewDeck): PreviewDeckWithTarget {
  return { ...deck, targetPane: resolvePreviewDeckTarget(deck.name) };
}

/** Embla loop needs enough slide mass for 38% card peek and 72% deck bands (6+ cards per hand). */
/** Static deck data mirrored from public/preview.html */
export const PREVIEW_DECKS: PreviewDeck[] = [
  {
    name: "Execution Deck",
    badge: "runtime cards",
    cards: [
      {
        type: "capture",
        title: "Survey Capture",
        purpose: "Echo silent screenshot → Mirage MUTHUR solve (3-device Survey Mode).",
      },
      {
        type: "capture",
        title: "Capture Builder Result",
        purpose: "Capture OpenCode output as the next runtime artifact.",
      },
      {
        type: "review",
        title: "Request Codex Review",
        purpose: "Send builder result to the reviewer surface.",
      },
      {
        type: "system",
        title: "Archive Outcome",
        purpose: "Turn completed card result into a receipt.",
      },
      {
        type: "runtime",
        title: "Emergency Halt",
        purpose: "Push halt card to the top of the stack.",
      },
      {
        type: "runtime",
        title: "Promote Card",
        purpose: "Move the staged card to the top of the execution stack.",
      },
      {
        type: "system",
        title: "Rollback Last",
        purpose: "Pop the most recent stack outcome back to staged review.",
      },
    ],
  },
  {
    name: "Diagnostics Deck",
    badge: "bridge health",
    cards: [
      {
        type: "diagnostic",
        title: "Run Probe Suite",
        purpose: "Check runtime health and known probes.",
      },
      {
        type: "diagnostic",
        title: "Inspect Surface",
        purpose: "Classify current operational surface.",
      },
      {
        type: "diagnostic",
        title: "Check Provider",
        purpose: "Verify active model gateway status.",
      },
      {
        type: "diagnostic",
        title: "Memory Recall",
        purpose: "Verify memory atlas recall for the active session.",
      },
      {
        type: "diagnostic",
        title: "Ping Gateway",
        purpose: "Send a lightweight gateway heartbeat through the deck bridge.",
      },
      {
        type: "diagnostic",
        title: "Session Trace",
        purpose: "Capture a short trace of the current operator session.",
      },
    ],
  },
  {
    name: "Quorum Deck",
    badge: "counsel cards",
    cards: [
      {
        type: "quorum",
        title: "Convene Quorum",
        purpose: "Ask counsel when route is uncertain.",
      },
      {
        type: "quorum",
        title: "Request Arbitration",
        purpose: "Escalate disagreement to operator.",
      },
      {
        type: "quorum",
        title: "Prepare Recovery Hand",
        purpose: "Deal recovery options after failure.",
      },
      {
        type: "quorum",
        title: "War room",
        purpose: "Open a fast counsel lane for incident response.",
      },
      {
        type: "quorum",
        title: "Second Opinion",
        purpose: "Route the active card to an alternate reviewer lane.",
      },
      {
        type: "quorum",
        title: "Dissolve Session",
        purpose: "Close the active counsel session without pushing stack.",
      },
    ],
  },
  {
    name: "Coding Deck",
    badge: "muthur // real disk",
    cards: [
      {
        type: "tool",
        title: "Git Status",
        purpose: "Manual override: git_status on the Echo Mirage repo.",
        toolOverride: { name: "git_status", args: {} },
      },
      {
        type: "tool",
        title: "Git Diff Stat",
        purpose: "Manual override: git_diff --stat summary.",
        toolOverride: { name: "git_diff", args: { stat: true } },
      },
      {
        type: "tool",
        title: "Typecheck",
        purpose: "Manual override: pnpm exec tsc --noEmit.",
        toolOverride: {
          name: "workspace_exec",
          args: { command: "pnpm exec tsc --noEmit" },
        },
      },
      {
        type: "tool",
        title: "Lint",
        purpose: "Manual override: pnpm lint.",
        toolOverride: { name: "workspace_exec", args: { command: "pnpm lint" } },
      },
      {
        type: "tool",
        title: "Coding Verify",
        purpose: "Manual override: git diff --stat + tsc --noEmit receipt.",
        toolOverride: { name: "coding_verify", args: {} },
      },
      {
        type: "tool",
        title: "Test Suite",
        purpose: "Manual override: pnpm test on the Echo Mirage workspace.",
        toolOverride: { name: "workspace_exec", args: { command: "pnpm test" } },
      },
    ],
  },
  {
    name: "Operator Deck",
    badge: "muthur // monaco",
    cards: [
      {
        type: "tool",
        title: "Observe Pane",
        purpose: "Manual override: observe_operator_pane for cyberdeck.",
        toolOverride: { name: "observe_operator_pane", args: { surface: "cyberdeck" } },
      },
      {
        type: "tool",
        title: "Open File",
        purpose: "Manual override: open_operator_file. Type a repo path in the composer, then push.",
        toolOverride: { name: "open_operator_file", args: { mode: "edit" }, composerArg: "filePath" },
      },
      {
        type: "tool",
        title: "Append Section",
        purpose:
          "Manual override: suggest_operator_edit append_section. Type text in the composer (file must be open).",
        toolOverride: {
          name: "suggest_operator_edit",
          args: { kind: "append_section" },
          composerArg: "text",
        },
      },
      {
        type: "tool",
        title: "Observe Operator",
        purpose: "Manual override: observe_operator_pane for the operator workspace.",
        toolOverride: { name: "observe_operator_pane", args: { surface: "operator" } },
      },
      {
        type: "tool",
        title: "Browser Snapshot",
        purpose: "Manual override: observe_operator_pane browser surface snapshot.",
        toolOverride: { name: "observe_operator_pane", args: { surface: "browser" } },
      },
      {
        type: "tool",
        title: "Open Readonly",
        purpose: "Manual override: open_operator_file in view mode. Type path in composer.",
        toolOverride: {
          name: "open_operator_file",
          args: { mode: "view" },
          composerArg: "filePath",
        },
      },
    ],
  },
  {
    name: "Filesystem Deck",
    badge: "muthur // localfs",
    cards: [
      {
        type: "tool",
        title: "Cat File",
        purpose: "Manual override: localfs cat. Type a path in the composer, then push.",
        toolOverride: { name: "localfs", args: { action: "cat" }, composerArg: "path" },
      },
      {
        type: "tool",
        title: "Git Diff Path",
        purpose: "Manual override: git_diff for one file. Type path in composer.",
        toolOverride: { name: "git_diff", args: { stat: false }, composerArg: "path" },
      },
      {
        type: "tool",
        title: "Stat File",
        purpose: "Manual override: localfs stat. Type path in composer.",
        toolOverride: { name: "localfs", args: { action: "stat" }, composerArg: "path" },
      },
      {
        type: "tool",
        title: "List Directory",
        purpose: "Manual override: localfs ls. Type a directory path in composer.",
        toolOverride: { name: "localfs", args: { action: "ls" }, composerArg: "path" },
      },
      {
        type: "tool",
        title: "Read Package",
        purpose: "Manual override: localfs cat package.json. Type path in composer.",
        toolOverride: { name: "localfs", args: { action: "cat" }, composerArg: "path" },
      },
      {
        type: "tool",
        title: "Inspect Root",
        purpose: "Manual override: localfs ls workspace root. Type . in composer.",
        toolOverride: { name: "localfs", args: { action: "ls" }, composerArg: "path" },
      },
    ],
  },
  {
    name: "Gateway Deck",
    badge: "signal route",
    cards: [
      {
        type: "gateway",
        title: "Ping Model Gateway",
        purpose: "Verify the active provider lane responds before pushing work.",
      },
      {
        type: "gateway",
        title: "Rotate Provider",
        purpose: "Switch the deck target to the next configured provider lane.",
      },
      {
        type: "gateway",
        title: "Surface Snapshot",
        purpose: "Capture the current gateway surface classification.",
      },
      {
        type: "gateway",
        title: "Connection Pulse",
        purpose: "Run a short connection pulse against the selected pane.",
      },
      {
        type: "gateway",
        title: "Uplink Verify",
        purpose: "Confirm chat uplink and command ingress are both live.",
      },
      {
        type: "gateway",
        title: "Key Rotation Prompt",
        purpose: "Open the provider key rotation checklist for the operator.",
      },
    ],
  },
  {
    name: "Stack Deck",
    badge: "stack runtime",
    cards: [
      {
        type: "stack",
        title: "Push Hand",
        purpose: "Stage the active hand onto the execution stack.",
      },
      {
        type: "stack",
        title: "Pop Top Card",
        purpose: "Remove the top card from the execution stack.",
      },
      {
        type: "stack",
        title: "Clear Stack",
        purpose: "Clear staged and stacked cards from the runtime deck.",
      },
      {
        type: "stack",
        title: "Describe Stack",
        purpose: "Render a receipt of the current stack depth and top card.",
      },
      {
        type: "stack",
        title: "Stage Recovery",
        purpose: "Deal a recovery hand after a failed stack execution.",
      },
      {
        type: "stack",
        title: "Receipt Top",
        purpose: "Archive the top stack card outcome as a system receipt.",
      },
    ],
  },
];

/** Glyph Channel demonstration: one vertical engine deck with horizontal action cards per engine. */
export const GLYPH_CHANNEL_PREVIEW_DECKS: PreviewDeck[] = [
  {
    name: "Text",
    badge: "plain text",
    cards: [
      {
        type: "text",
        title: "Render Plain Text",
        purpose: "Send the current instruction to Glyph Channel as a clean text render.",
      },
      {
        type: "text",
        title: "Status Line",
        purpose: "Render a compact status line into the glyph surface.",
      },
      {
        type: "text",
        title: "Operator Note",
        purpose: "Push a short operator note as plain text.",
      },
      {
        type: "text",
        title: "Route Label",
        purpose: "Label the active target pane in plain text.",
      },
      {
        type: "text",
        title: "Receipt Body",
        purpose: "Render stack receipt prose without ASCII ornament.",
      },
      {
        type: "text",
        title: "Brief Caption",
        purpose: "Send a one-sentence caption to the glyph channel.",
      },
    ],
  },
  {
    name: "1 Line ASCII",
    badge: "one-line art",
    cards: [
      {
        type: "1 line ascii",
        title: "Signal Route",
        purpose: "Compact directional line for routing a selected pane.",
        preview: { kind: "oneline", value: "<===[ POWERFIST ]===>" },
      },
      {
        type: "1 line ascii",
        title: "Divider Pulse",
        purpose: "Narrow divider line that can travel through chat and logs.",
        preview: { kind: "oneline", value: "----[ ECHO MIRAGE ]----" },
      },
      {
        type: "1 line ascii",
        title: "Status Spark",
        purpose: "Short one-line status ornament for the selected pane.",
        preview: { kind: "oneline", value: "*.*.* UPLINK VERIFIED *.*.*" },
      },
      {
        type: "1 line ascii",
        title: "Banner Trace",
        purpose: "Compact decorative trace from the one-line showroom catalog.",
        preview: { kind: "oneline", value: "<<<---=={ SIGNAL }==--->>>" },
      },
      {
        type: "1 line ascii",
        title: "Deck Lane",
        purpose: "Horizontal lane marker for deck navigation.",
        preview: { kind: "oneline", value: "==[ DECK // HAND // PUSH ]==" },
      },
      {
        type: "1 line ascii",
        title: "Gate Trace",
        purpose: "Gateway trace line for provider routing cards.",
        preview: { kind: "oneline", value: ">> GATEWAY // OPEN ROUTE <<" },
      },
    ],
  },
  {
    name: "Figlet",
    badge: "font render",
    cards: [
      {
        type: "figlet",
        title: "ANSI Shadow",
        purpose: "Rendered ECHO banner in ANSI Shadow.",
        preview: { kind: "figlet", value: "ANSI Shadow" },
      },
      {
        type: "figlet",
        title: "Impossible",
        purpose: "Rendered ECHO banner in Impossible.",
        preview: { kind: "figlet", value: "Impossible" },
      },
      {
        type: "figlet",
        title: "S Blood",
        purpose: "Rendered ECHO banner in S Blood.",
        preview: { kind: "figlet", value: "S Blood" },
      },
      {
        type: "figlet",
        title: "Slant",
        purpose: "Rendered ECHO banner in Slant.",
        preview: { kind: "figlet", value: "Slant" },
      },
      {
        type: "figlet",
        title: "Standard",
        purpose: "Rendered ECHO banner in Standard.",
        preview: { kind: "figlet", value: "Standard" },
      },
      {
        type: "figlet",
        title: "Small",
        purpose: "Rendered ECHO banner in Small.",
        preview: { kind: "figlet", value: "Small" },
      },
    ],
  },
  {
    name: "Divider",
    badge: "separators",
    cards: [
      {
        type: "1 line ascii",
        title: "Thin Rule",
        purpose: "Minimal divider for chat receipts.",
        preview: { kind: "oneline", value: "------------------------" },
      },
      {
        type: "1 line ascii",
        title: "Heavy Rule",
        purpose: "Strong divider for stack transitions.",
        preview: { kind: "oneline", value: "========================" },
      },
      {
        type: "1 line ascii",
        title: "Corner Rule",
        purpose: "Cornered divider for pane headers.",
        preview: { kind: "oneline", value: "+----------------------+" },
      },
      {
        type: "1 line ascii",
        title: "Wave Rule",
        purpose: "Soft wave divider for voice deck receipts.",
        preview: { kind: "oneline", value: "~~~~~~~~~~~~~~~~~~~~~~~~" },
      },
      {
        type: "1 line ascii",
        title: "Hash Rule",
        purpose: "Hash divider for diagnostics output.",
        preview: { kind: "oneline", value: "########################" },
      },
      {
        type: "1 line ascii",
        title: "Chevron Rule",
        purpose: "Chevron divider for execution deck receipts.",
        preview: { kind: "oneline", value: ">>>>>>>>>>>>>>>>>>>>>>>>" },
      },
    ],
  },
  {
    name: "Signal",
    badge: "route marks",
    cards: [
      {
        type: "1 line ascii",
        title: "Northbound",
        purpose: "Directional route marker for deck-up navigation.",
        preview: { kind: "oneline", value: " /\\  NORTH ROUTE  /\\ " },
      },
      {
        type: "1 line ascii",
        title: "Southbound",
        purpose: "Directional route marker for deck-down navigation.",
        preview: { kind: "oneline", value: " \\/  SOUTH ROUTE  \\/ " },
      },
      {
        type: "1 line ascii",
        title: "Port Lane",
        purpose: "Left-hand lane marker for card navigation.",
        preview: { kind: "oneline", value: "<< PORT // HAND // SWIPE <<" },
      },
      {
        type: "1 line ascii",
        title: "Starboard Lane",
        purpose: "Right-hand lane marker for card navigation.",
        preview: { kind: "oneline", value: ">> STARBOARD // HAND >>" },
      },
      {
        type: "1 line ascii",
        title: "Uplink Mark",
        purpose: "Signal mark for gateway uplink verification.",
        preview: { kind: "oneline", value: "== UPLINK // VERIFIED ==" },
      },
      {
        type: "1 line ascii",
        title: "Beacon Mark",
        purpose: "Beacon mark for stack push confirmation.",
        preview: { kind: "oneline", value: "** STACK // PUSH // OK **" },
      },
    ],
  },
  {
    name: "Banner",
    badge: "wide figlet",
    cards: [
      {
        type: "figlet",
        title: "Big",
        purpose: "Wide banner render in Big.",
        preview: { kind: "figlet", value: "Big" },
      },
      {
        type: "figlet",
        title: "Block",
        purpose: "Wide banner render in Block.",
        preview: { kind: "figlet", value: "Block" },
      },
      {
        type: "figlet",
        title: "Doom",
        purpose: "Wide banner render in Doom.",
        preview: { kind: "figlet", value: "Doom" },
      },
      {
        type: "figlet",
        title: "Larry 3D",
        purpose: "Wide banner render in Larry 3D.",
        preview: { kind: "figlet", value: "Larry 3D" },
      },
      {
        type: "figlet",
        title: "Colossal",
        purpose: "Wide banner render in Colossal.",
        preview: { kind: "figlet", value: "Colossal" },
      },
      {
        type: "figlet",
        title: "Digital",
        purpose: "Wide banner render in Digital.",
        preview: { kind: "figlet", value: "Digital" },
      },
    ],
  },
];

/** Full matrix carousel: main decks then glyph-channel engine decks. Target pane follows the active deck. */
export const ALL_PREVIEW_DECKS: PreviewDeckWithTarget[] = [
  ...PREVIEW_DECKS.map(withPreviewDeckTarget),
  ...GLYPH_CHANNEL_PREVIEW_DECKS.map(withPreviewDeckTarget),
];
