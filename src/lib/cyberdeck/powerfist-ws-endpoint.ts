/** Optional client override when PowerFist hub runs as Go sidecar. */

export function applyPowerfistWsEnvOverride(host: string, port: number): { host: string; port: number } {
  const envHost =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ECHO_MIRAGE_POWERFIST_WS_HOST?.trim()) ||
    "";
  const envPortRaw =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ECHO_MIRAGE_POWERFIST_WS_PORT?.trim()) ||
    "";
  const envPort = Number(envPortRaw);
  return {
    host: envHost || host,
    port: Number.isFinite(envPort) && envPort > 0 ? envPort : port,
  };
}

export function rewritePowerfistWsUrl(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    const { host, port } = applyPowerfistWsEnvOverride(url.hostname, Number(url.port) || 80);
    url.hostname = host;
    url.port = String(port);
    return url.toString();
  } catch {
    return wsUrl;
  }
}
