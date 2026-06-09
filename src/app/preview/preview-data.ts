export type PreviewCardRisk = "safe" | "caution" | "restricted";

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
  risk: PreviewCardRisk;
  preview?: {
    kind: "figlet" | "oneline";
    value: string;
  };
  toolOverride?: PreviewCardToolOverride;
};

export type PreviewDeck = {
  name: string;
  badge: string;
  cards: PreviewCard[];
};

/** Static deck data mirrored from public/preview.html */
export const PREVIEW_DECKS: PreviewDeck[] = [
  {
    name: "Execution Deck",
    badge: "runtime cards",
    cards: [
      {
        type: "capture",
        title: "Capture Builder Result",
        purpose: "Capture OpenCode output as the next runtime artifact.",
        risk: "safe",
      },
      {
        type: "review",
        title: "Request Codex Review",
        purpose: "Send builder result to the reviewer surface.",
        risk: "caution",
      },
      {
        type: "system",
        title: "Archive Outcome",
        purpose: "Turn completed card result into a receipt.",
        risk: "safe",
      },
      {
        type: "runtime",
        title: "Emergency Halt",
        purpose: "Push halt card to the top of the stack.",
        risk: "restricted",
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
        risk: "caution",
      },
      {
        type: "diagnostic",
        title: "Inspect Surface",
        purpose: "Classify current operational surface.",
        risk: "safe",
      },
      {
        type: "diagnostic",
        title: "Check Provider",
        purpose: "Verify active model gateway status.",
        risk: "safe",
      },
      {
        type: "diagnostic",
        title: "Memory Recall",
        purpose: "Verify active model gateway status.",
        risk: "safe",
      },
    ],
  },
  {
    name: "Voice Deck",
    badge: "vox net",
    cards: [
      {
        type: "voice",
        title: "MUTHUR Voice",
        purpose: "Load calm ship AI narration posture.",
        risk: "safe",
      },
      {
        type: "voice",
        title: "Reviewer Voice",
        purpose: "Load dry verification narration mode.",
        risk: "safe",
      },
      {
        type: "voice",
        title: "Emergency Voice",
        purpose: "Use short critical alert narration.",
        risk: "caution",
      },
      {
        type: "voice",
        title: "Jeena Jacket Voice",
        purpose: "Load calm ship AI narration posture.",
        risk: "safe",
      },
      {
        type: "voice",
        title: "Cory Chase Voice",
        purpose: "Load calm ship AI narration posture.",
        risk: "safe",
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
        risk: "caution",
      },
      {
        type: "quorum",
        title: "Request Arbitration",
        purpose: "Escalate disagreement to operator.",
        risk: "safe",
      },
      {
        type: "quorum",
        title: "Prepare Recovery Hand",
        purpose: "Deal recovery options after failure.",
        risk: "safe",
      },
      {
        type: "quorum",
        title: "War room",
        purpose: "Deal recovery options after failure.",
        risk: "safe",
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
        risk: "safe",
        toolOverride: { name: "git_status", args: {} },
      },
      {
        type: "tool",
        title: "Git Diff Stat",
        purpose: "Manual override: git_diff --stat summary.",
        risk: "safe",
        toolOverride: { name: "git_diff", args: { stat: true } },
      },
      {
        type: "tool",
        title: "Typecheck",
        purpose: "Manual override: pnpm exec tsc --noEmit.",
        risk: "safe",
        toolOverride: {
          name: "workspace_exec",
          args: { command: "pnpm exec tsc --noEmit" },
        },
      },
      {
        type: "tool",
        title: "Lint",
        purpose: "Manual override: pnpm lint.",
        risk: "caution",
        toolOverride: { name: "workspace_exec", args: { command: "pnpm lint" } },
      },
      {
        type: "tool",
        title: "Coding Verify",
        purpose: "Manual override: git diff --stat + tsc --noEmit receipt.",
        risk: "caution",
        toolOverride: { name: "coding_verify", args: {} },
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
        risk: "safe",
        toolOverride: { name: "observe_operator_pane", args: { surface: "cyberdeck" } },
      },
      {
        type: "tool",
        title: "Open File",
        purpose: "Manual override: open_operator_file. Type a repo path in the composer, then push.",
        risk: "safe",
        toolOverride: { name: "open_operator_file", args: { mode: "edit" }, composerArg: "filePath" },
      },
      {
        type: "tool",
        title: "Append Section",
        purpose:
          "Manual override: suggest_operator_edit append_section. Type text in the composer (file must be open).",
        risk: "caution",
        toolOverride: {
          name: "suggest_operator_edit",
          args: { kind: "append_section" },
          composerArg: "text",
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
        risk: "safe",
        toolOverride: { name: "localfs", args: { action: "cat" }, composerArg: "path" },
      },
      {
        type: "tool",
        title: "Git Diff Path",
        purpose: "Manual override: git_diff for one file. Type path in composer.",
        risk: "safe",
        toolOverride: { name: "git_diff", args: { stat: false }, composerArg: "path" },
      },
      {
        type: "tool",
        title: "Stat File",
        purpose: "Manual override: localfs stat. Type path in composer.",
        risk: "safe",
        toolOverride: { name: "localfs", args: { action: "stat" }, composerArg: "path" },
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
        risk: "safe",
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
        risk: "safe",
        preview: { kind: "oneline", value: "<===[ POWERFIST ]===>" },
      },
      {
        type: "1 line ascii",
        title: "Divider Pulse",
        purpose: "Narrow divider line that can travel through chat and logs.",
        risk: "safe",
        preview: { kind: "oneline", value: "----[ ECHO MIRAGE ]----" },
      },
      {
        type: "1 line ascii",
        title: "Status Spark",
        purpose: "Short one-line status ornament for the selected pane.",
        risk: "safe",
        preview: { kind: "oneline", value: "*.*.* UPLINK VERIFIED *.*.*" },
      },
      {
        type: "1 line ascii",
        title: "Banner Trace",
        purpose: "Compact decorative trace from the one-line showroom catalog.",
        risk: "safe",
        preview: { kind: "oneline", value: "<<<---=={ SIGNAL }==--->>>" },
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
        risk: "safe",
        preview: { kind: "figlet", value: "ANSI Shadow" },
      },
      {
        type: "figlet",
        title: "Impossible",
        purpose: "Rendered ECHO banner in Impossible.",
        risk: "safe",
        preview: { kind: "figlet", value: "Impossible" },
      },
      {
        type: "figlet",
        title: "S Blood",
        purpose: "Rendered ECHO banner in S Blood.",
        risk: "safe",
        preview: { kind: "figlet", value: "S Blood" },
      },
      {
        type: "figlet",
        title: "Slant",
        purpose: "Rendered ECHO banner in Slant.",
        risk: "caution",
        preview: { kind: "figlet", value: "Slant" },
      },
    ],
  },
];
