import type { DeckAppId } from "@/lib/deck-app";

export type DeckAppDefinition = {
  id: DeckAppId;
  name: string;
  tagline: string;
  description: string;
  glyph: string;
};

export const DECK_APP_DEFINITIONS: readonly DeckAppDefinition[] = [
  {
    id: "echo-mirage",
    name: "Echo Mirage",
    tagline: "Cyberdeck command surface",
    description:
      "Default Craftwerk cyberdeck — operator document plane, gateway uplink, glyph channel, and MUTHUR orchestration.",
    glyph: "EM",
  },
  {
    id: "property-management",
    name: "Property Management",
    tagline: "Real estate operations",
    description:
      "Department workspace for portfolios, leasing, maintenance, accounting, inspections, documents, and map views.",
    glyph: "PM",
  },
] as const;

export function deckAppDefinitionFor(id: DeckAppId): DeckAppDefinition {
  return DECK_APP_DEFINITIONS.find((app) => app.id === id) ?? DECK_APP_DEFINITIONS[0];
}

/** Custom tab kinds exposed on the rail when Property Management is the active deck app. */
export const PROPERTY_MANAGEMENT_TAB_KINDS = ["apps", "call-center"] as const;

export type PropertyManagementTabKind = (typeof PROPERTY_MANAGEMENT_TAB_KINDS)[number];

export function isPropertyManagementTabKind(kind: string): kind is PropertyManagementTabKind {
  return (PROPERTY_MANAGEMENT_TAB_KINDS as readonly string[]).includes(kind);
}
