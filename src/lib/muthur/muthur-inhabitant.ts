/** Which AI inhabits the MUTHUR command console composer. */

export type MuthurInhabitant = "muthur" | "codex" | "pi";

export const MUTHUR_INHABITANT_STORAGE_KEY = "echo-mirage-muthur-inhabitant-v1";

const DEFAULT_INHABITANT: MuthurInhabitant = "muthur";

export const MUTHUR_INHABITANT_SELECTOR: MuthurInhabitant[] = ["muthur", "codex", "pi"];

export type MuthurInhabitantMeta = {
  id: MuthurInhabitant;
  label: string;
  title: string;
  channelLabel: string;
};

export const MUTHUR_INHABITANTS: MuthurInhabitantMeta[] = [
  {
    id: "muthur",
    label: "Muthur",
    title: "Gateway uplink — tools, posture, operator panes",
    channelLabel: "MUTHUR",
  },
  {
    id: "codex",
    label: "Codex",
    title: "Codex CLI — subscription login, no gateway key",
    channelLabel: "CODEX",
  },
  {
    id: "pi",
    label: "Pi",
    title: "Pi uplink — desktop embodiment operator",
    channelLabel: "PI",
  },
];

export function normalizeMuthurInhabitant(value: string | null | undefined): MuthurInhabitant {
  if (value === "codex" || value === "pi" || value === "muthur") {
    return value;
  }
  return DEFAULT_INHABITANT;
}

export function loadMuthurInhabitant(): MuthurInhabitant {
  if (typeof window === "undefined") return DEFAULT_INHABITANT;
  try {
    return normalizeMuthurInhabitant(window.localStorage.getItem(MUTHUR_INHABITANT_STORAGE_KEY));
  } catch {
    return DEFAULT_INHABITANT;
  }
}

export function saveMuthurInhabitant(inhabitant: MuthurInhabitant): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_INHABITANT_STORAGE_KEY, inhabitant);
  } catch {
    // ignore storage write failures
  }
}

export function getMuthurInhabitantMeta(inhabitant: MuthurInhabitant): MuthurInhabitantMeta {
  return MUTHUR_INHABITANTS.find((entry) => entry.id === inhabitant) ?? MUTHUR_INHABITANTS[0];
}

export function formatInhabitantChannelLabel(inhabitant?: MuthurInhabitant | null): string {
  return getMuthurInhabitantMeta(normalizeMuthurInhabitant(inhabitant ?? DEFAULT_INHABITANT))
    .channelLabel;
}

export function formatMuthurInhabitantChangedLine(
  from: MuthurInhabitant,
  to: MuthurInhabitant,
): string {
  return `INHABITANT // ${formatInhabitantChannelLabel(from)} → ${formatInhabitantChannelLabel(to)}`;
}
