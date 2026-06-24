const DIRECT_ENV = "MUTHUR_DIRECT_PI_COMPUTER_USE";

/**
 * When enabled, MUTHUR may call pi_computer_use directly (Synapse / windows-use)
 * after operator grant — intended for local integration testing.
 */
export function isMuthurDirectPiComputerUseEnabled(): boolean {
  const raw = process.env[DIRECT_ENV];
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return process.env.NODE_ENV !== "production";
}
