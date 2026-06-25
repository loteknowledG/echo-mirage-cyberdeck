/**
 * Client-only Pi control UI gating (NEXT_PUBLIC only — never read server env in the browser bundle).
 * Default: no Grant Control modal.
 */
export function isPiControlLeaseUiGatingEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_MUTHUR_PI_CONTROL_GATING?.trim().toLowerCase();
  return pub === "1" || pub === "true" || pub === "yes";
}
