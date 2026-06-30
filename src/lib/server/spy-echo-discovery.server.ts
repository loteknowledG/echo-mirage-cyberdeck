// SERVER ONLY — find Echo Satellite pair servers on the local LAN.
import os from "node:os";

const DEFAULT_ECHO_HTTP_PORT = 3050;
const PROBE_TIMEOUT_MS = 650;
const MAX_HOSTS_PER_SUBNET = 64;
const PROBE_BATCH_SIZE = 24;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

function localIpv4Subnets(): string[] {
  const prefixes = new Set<string>();
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const base = ipv4ToInt(entry.address);
      if (base === null) continue;
      const network = base & 0xffffff00;
      prefixes.add(intToIpv4(network));
    }
  }
  return [...prefixes];
}

function subnetHosts(prefix: string): string[] {
  const base = ipv4ToInt(prefix);
  if (base === null) return [];
  const hosts: string[] = [];
  for (let offset = 1; offset <= MAX_HOSTS_PER_SUBNET; offset += 1) {
    hosts.push(intToIpv4(base + offset));
  }
  return hosts;
}

async function probeEchoHost(host: string, port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const paths =
    port === DEFAULT_ECHO_HTTP_PORT
      ? ["/api/spy/echo/codes", "/spy/status", "/health"]
      : ["/api/spy/echo/codes"];

  try {
    for (const path of paths) {
      try {
        const res = await fetch(`http://${host}:${port}${path}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) continue;
        if (path === "/health") return true;
        const payload = (await res.json()) as {
          ok?: boolean;
          echoNodeId?: string;
          source?: string;
        };
        if (payload.ok === true && typeof payload.echoNodeId === "string" && payload.echoNodeId.length > 0) {
          return true;
        }
        if (payload.source === "echo-satellite") return true;
      } catch {
        /* try next path */
      }
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Scan local /24 subnets for Echo pair servers listening on `port`. */
export async function discoverEchoHosts(port = DEFAULT_ECHO_HTTP_PORT): Promise<string[]> {
  const candidates = new Set<string>();
  for (const prefix of localIpv4Subnets()) {
    for (const host of subnetHosts(prefix)) {
      candidates.add(host);
    }
  }

  const found: string[] = [];
  const hosts = [...candidates];
  for (let index = 0; index < hosts.length; index += PROBE_BATCH_SIZE) {
    const batch = hosts.slice(index, index + PROBE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (host) => ((await probeEchoHost(host, port)) ? host : null)),
    );
    for (const host of results) {
      if (host) found.push(host);
    }
  }
  return found;
}

export async function discoverEchoHost(port = DEFAULT_ECHO_HTTP_PORT): Promise<string | null> {
  const hosts = await discoverEchoHosts(port);
  return hosts[0] ?? null;
}
