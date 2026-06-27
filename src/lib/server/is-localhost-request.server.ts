/** True when the request originates from the local Echo Mirage desktop shell. */
export function isLocalhostRequest(request: Request): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return true;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
      return true;
    }
  }

  return false;
}

export function resolveHttpPort(): number {
  const fromEnv = Number(process.env.PORT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 3050;
}
