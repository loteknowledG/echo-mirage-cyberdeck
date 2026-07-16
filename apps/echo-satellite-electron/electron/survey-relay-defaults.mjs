/** Built-in defaults for the public Echo Mirage cyberdeck - no paste required. */
export const DEFAULT_SURVEY_RELAY_BASE_URL = "https://echo-mirage-cyberdeck.vercel.app";

/**
 * Empty by default: production middlebox does not require a shared secret.
 * Optional override via env / userData survey-relay.env if you lock the relay down.
 */
export const DEFAULT_SURVEY_RELAY_SECRET = "";
