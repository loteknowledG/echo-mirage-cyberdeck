/** Espionage Spy pairing — 6-digit PIN shown on Echo, typed on Mirage / PowerFist. */

export const SPY_PAIR_PIN_LENGTH = 6;

export function normalizeSpyPairPin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, SPY_PAIR_PIN_LENGTH);
}

export function isValidSpyPairPin(raw: string): boolean {
  return new RegExp(`^\\d{${SPY_PAIR_PIN_LENGTH}}$`).test(raw);
}
