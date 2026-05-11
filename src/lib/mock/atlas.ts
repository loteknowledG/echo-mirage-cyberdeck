export type AtlasEntity = {
  id: string;
  label: string;
  aliases: string[];
  relations: Array<{ targetId: string; type: string }>;
  confidence: number;
  source: string;
};

export const ATLAS_ENTITIES: AtlasEntity[] = [
  {
    id: "chatgpt-lead",
    label: "ChatGPT // Lead",
    aliases: ["Lead Node", "Command Router"],
    relations: [
      { targetId: "cursor-dev", type: "coordinates" },
      { targetId: "deck-core", type: "routes" },
    ],
    confidence: 0.94,
    source: "operator-manifest",
  },
  {
    id: "cursor-dev",
    label: "Cursor // Dev",
    aliases: ["Patch Driver", "Workspace Cartographer"],
    relations: [
      { targetId: "rail-bus", type: "indexes" },
      { targetId: "codex-test", type: "hands-off" },
    ],
    confidence: 0.91,
    source: "operator-manifest",
  },
  {
    id: "codex-test",
    label: "Codex // Test",
    aliases: ["Surface Probe", "Stability Unit"],
    relations: [
      { targetId: "flight-log", type: "verifies" },
      { targetId: "deck-core", type: "probes" },
    ],
    confidence: 0.89,
    source: "verification-matrix",
  },
  {
    id: "samus-manus-memory",
    label: "Samus-Manus // Memory",
    aliases: ["Recall Lattice", "Anchor Keeper"],
    relations: [
      { targetId: "memory-atlas", type: "maintains" },
      { targetId: "flight-log", type: "archives" },
    ],
    confidence: 0.93,
    source: "memory-index",
  },
  {
    id: "deck-core",
    label: "Deck Core",
    aliases: ["Cold Start Reactor", "Main Spine"],
    relations: [
      { targetId: "rail-bus", type: "powers" },
      { targetId: "ambient-scanline", type: "feeds" },
    ],
    confidence: 0.88,
    source: "deck-telemetry",
  },
  {
    id: "rail-bus",
    label: "Rail Bus",
    aliases: ["Tab Bus", "Module Rail"],
    relations: [
      { targetId: "command-module", type: "hosts" },
      { targetId: "catalog-module", type: "hosts" },
    ],
    confidence: 0.86,
    source: "bus-map-v2",
  },
  {
    id: "command-module",
    label: "Command Module",
    aliases: ["CLI Surface", "Prompt Deck"],
    relations: [{ targetId: "flight-log", type: "emits" }],
    confidence: 0.87,
    source: "module-registry",
  },
  {
    id: "catalog-module",
    label: "Catalog Module",
    aliases: ["Manifest Browser", "Inventory Surface"],
    relations: [{ targetId: "memory-atlas", type: "references" }],
    confidence: 0.82,
    source: "module-registry",
  },
  {
    id: "flight-log",
    label: "Flight Log",
    aliases: ["Ops Trace", "Event Spine"],
    relations: [{ targetId: "memory-atlas", type: "feeds" }],
    confidence: 0.9,
    source: "log-bus",
  },
  {
    id: "memory-atlas",
    label: "Memory Atlas",
    aliases: ["Entity Grid", "Semantic Deckmap"],
    relations: [{ targetId: "samus-manus-memory", type: "syncs-with" }],
    confidence: 0.92,
    source: "atlas-seed",
  },
  {
    id: "voice-lab",
    label: "Voice Lab",
    aliases: ["Signal Forge", "Audio Bay"],
    relations: [{ targetId: "deck-core", type: "modulates" }],
    confidence: 0.79,
    source: "module-registry",
  },
  {
    id: "ambient-scanline",
    label: "Ambient Scanline",
    aliases: ["Presence Drift", "Visual Carrier"],
    relations: [{ targetId: "deck-core", type: "overlays" }],
    confidence: 0.76,
    source: "visual-telemetry",
  },
];
