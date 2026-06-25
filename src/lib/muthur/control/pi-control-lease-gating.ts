/**
 * Pi control lease gating — opt-in only.
 * Default: no modal, auto-grant when MUTHUR requests desktop control.
 * Set MUTHUR_PI_CONTROL_GATING=1 (server) or NEXT_PUBLIC_MUTHUR_PI_CONTROL_GATING=1 (client UI) to restore the Grant Control dialog.
 */
export function isPiControlLeaseGatingEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_MUTHUR_PI_CONTROL_GATING?.trim().toLowerCase();
  if (pub === "1" || pub === "true" || pub === "yes") return true;
  if (pub === "0" || pub === "false" || pub === "no") return false;

  const priv = process.env.MUTHUR_PI_CONTROL_GATING?.trim().toLowerCase();
  if (priv === "1" || priv === "true" || priv === "yes") return true;
  if (priv === "0" || priv === "false" || priv === "no") return false;

  return false;
}
