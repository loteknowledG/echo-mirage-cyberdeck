import { ENABLE_CARD_TABLE } from "@/features/cyberdeck/workspace/custom-tab-model";

export const CYBERDECK_FIXED_SERVERS = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  ...(ENABLE_CARD_TABLE ? [{ id: "ct", glyph: "◈", label: "CARD TABLE" }] : []),
  { id: "b", glyph: "§", label: "SETTINGS" },
] as Array<{ id: string; glyph: string; label: string }>;
