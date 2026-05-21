export type PreviewCardRisk = "safe" | "caution" | "restricted";

export type PreviewCard = {
  type: string;
  title: string;
  purpose: string;
  risk: PreviewCardRisk;
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
      {
        type: "quorum",
        title: "Gangbang",
        purpose: "Deal recovery options after failure.",
        risk: "safe",
      },
    ],
  },
];
