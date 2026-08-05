export type EchoHeaderLogoMode = "classic" | "dynamic";

export const ECHO_HEADER_LOGO_MODE_STORAGE_KEY = "echo-mirage-echo-header-logo-mode-v1";
export const ECHO_HEADER_LOGO_MODE_CHANGED_EVENT = "echo-mirage-echo-header-logo-mode-changed";
export const ECHO_HEADER_LOGO_REROLL_EVENT = "echo-mirage-echo-header-logo-reroll";
export const ECHO_HEADER_LOGO_RENDERED_EVENT = "echo-mirage-echo-header-logo-rendered";

export const ECHO_HEADER_LOGO_TEXT = "ECHO";
export const MIRAGE_HEADER_LOGO_TEXT = "MIRAGE";
export const ECHO_HEADER_CLASSIC_FIGLET_FONT = "Impossible";

const DEFAULT_MODE: EchoHeaderLogoMode = "dynamic";

function isEchoHeaderLogoMode(value: string | null | undefined): value is EchoHeaderLogoMode {
  return value === "classic" || value === "dynamic";
}

export function readEchoHeaderLogoMode(): EchoHeaderLogoMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const stored = window.localStorage.getItem(ECHO_HEADER_LOGO_MODE_STORAGE_KEY);
  return isEchoHeaderLogoMode(stored) ? stored : DEFAULT_MODE;
}

export function writeEchoHeaderLogoMode(mode: EchoHeaderLogoMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ECHO_HEADER_LOGO_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(ECHO_HEADER_LOGO_MODE_CHANGED_EVENT, { detail: { mode } }));
}

export function requestEchoHeaderLogoReroll(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ECHO_HEADER_LOGO_REROLL_EVENT));
}
