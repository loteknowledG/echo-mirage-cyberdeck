/** Echo Mirage Espionage Mode — 3-device team: Echo + Mirage + PowerFist (phone). */

export type EspionageNodeRole = "echo" | "mirage" | "off";

export const ESPIONAGE_MODE_STORAGE_KEY = "echo-mirage-espionage-role";
export const ESPIONAGE_NODE_ID_STORAGE_KEY = "echo-mirage-espionage-node-id";

/** Capture desk — silent screenshot of the coding question. */
export const ESPIONAGE_ROLE_ECHO: EspionageNodeRole = "echo";

/** Solver hub — MUTHUR generates the answer from Echo's capture. */
export const ESPIONAGE_ROLE_MIRAGE: EspionageNodeRole = "mirage";

export const ESPIONAGE_ECHO_NODE_LABEL = "echo";
export const ESPIONAGE_MIRAGE_NODE_LABEL = "mirage";
export const ESPIONAGE_POWERFIST_LABEL = "powerfist";

export const ESPIONAGE_MODE_TITLE = "ESPIONAGE MODE";
export const ESPIONAGE_MODE_SHORT = "Espionage";

export const ESPIONAGE_ECHO_DISPLAY = "ECHO";
export const ESPIONAGE_MIRAGE_DISPLAY = "MIRAGE";

export const ESPIONAGE_ECHO_TAGLINE = "Screenshot computer — silent capture of the coding question.";
export const ESPIONAGE_MIRAGE_TAGLINE = "Answer computer — AI solves from Echo's capture.";
export const ESPIONAGE_POWERFIST_TAGLINE = "Phone trigger — PowerFist starts the mission.";

export function espionageRoleLabel(role: EspionageNodeRole): string {
  switch (role) {
    case "echo":
      return ESPIONAGE_ECHO_DISPLAY;
    case "mirage":
      return ESPIONAGE_MIRAGE_DISPLAY;
    case "off":
      return "OFF";
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export function getOrCreateEspionageNodeId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(ESPIONAGE_NODE_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(ESPIONAGE_NODE_ID_STORAGE_KEY, created);
  return created;
}

export function readEspionageNodeRole(): EspionageNodeRole {
  if (typeof window === "undefined") return "off";
  const raw = window.localStorage.getItem(ESPIONAGE_MODE_STORAGE_KEY)?.trim();
  if (raw === "echo" || raw === "mirage") return raw;
  return "off";
}

export function writeEspionageNodeRole(role: EspionageNodeRole): void {
  if (typeof window === "undefined") return;
  if (role === "off") {
    window.localStorage.removeItem(ESPIONAGE_MODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ESPIONAGE_MODE_STORAGE_KEY, role);
}

export function espionageTeamSummary(role: EspionageNodeRole): string {
  if (role === "echo") {
    return `${ESPIONAGE_MODE_TITLE} // ${ESPIONAGE_ECHO_DISPLAY} — pair with ${ESPIONAGE_MIRAGE_DISPLAY}, then wait for PowerFist capture missions.`;
  }
  if (role === "mirage") {
    return `${ESPIONAGE_MODE_TITLE} // ${ESPIONAGE_MIRAGE_DISPLAY} — hub for ${ESPIONAGE_ECHO_DISPLAY} + PowerFist; answers land here in MUTHUR.`;
  }
  return `${ESPIONAGE_MODE_TITLE} — assign this machine as ${ESPIONAGE_ECHO_DISPLAY} or ${ESPIONAGE_MIRAGE_DISPLAY}.`;
}
