export const ENABLE_CARD_TABLE = process.env.NEXT_PUBLIC_ENABLE_CARD_TABLE === "true";

const DEFAULT_SERVER_ID = "s";

export function safeServerId(id: string): string {
  if (id === "p") {
    return DEFAULT_SERVER_ID;
  }
  if (id === "ct" && !ENABLE_CARD_TABLE) {
    return DEFAULT_SERVER_ID;
  }
  return id;
}

export const servers = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "w", glyph: "W", label: "WEB" },
  { id: "c", glyph: "C", label: "CONNECTION" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  ...(ENABLE_CARD_TABLE ? [{ id: "ct", glyph: "◈", label: "CARD TABLE" }] : []),
  { id: "h", glyph: "π", label: "DIAGNOSTIC" },
  { id: "b", glyph: "§", label: "SETTINGS" },
] as const;

export type ServerRailButton = (typeof servers)[number];

export const SERVER_IDS = ENABLE_CARD_TABLE
  ? (["m", "s", "ct", "b"] as const)
  : (["m", "s", "b"] as const);

export type ServerId = (typeof SERVER_IDS)[number];

export function isFixedServerTabId(id: string): id is ServerId {
  return (SERVER_IDS as readonly string[]).includes(id);
}
