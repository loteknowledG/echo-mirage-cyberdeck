const PROBE_BYPASS_ENV = "PI_COMPUTER_USE_PROBE_BYPASS";

/** Test/probe scripts only — never enabled in production. */
export function isPiProbeLeaseBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env[PROBE_BYPASS_ENV] === "1";
}
