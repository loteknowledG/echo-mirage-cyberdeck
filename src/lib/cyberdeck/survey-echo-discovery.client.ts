"use client";

export type EchoEndpoint = {
  host: string;
  port: number;
};

const PROBE_PORTS = [3050, 3000, 3001] as const;
const PROBE_TIMEOUT_MS = 900;
const PROBE_BATCH_SIZE = 24;
const MAX_HOSTS_PER_SUBNET = 64;
const PAIR_DISCOVERY_TIMEOUT_MS = 28_000;

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

function subnetPrefixFromIp(ip: string): string | null {
  const base = ipv4ToInt(ip);
  if (base === null) return null;
  return intToIpv4(base & 0xffffff00);
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

/** Discover this device's LAN IPv4 via WebRTC (browser-only). */
export async function discoverLocalIpv4Addresses(): Promise<string[]> {
  if (typeof window === "undefined") return [];

  return new Promise((resolve) => {
    const found = new Set<string>();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        pc.close();
      } catch {
        /* ignore */
      }
      resolve([...found]);
    };

    const timer = window.setTimeout(finish, 2500);

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch {
      window.clearTimeout(timer);
      resolve([]);
      return;
    }

    pc.createDataChannel("echo-discovery");
    pc.onicecandidate = (event) => {
      const candidate = event.candidate?.candidate ?? "";
      const match = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(candidate);
      if (!match?.[1]) return;
      const ip = match[1];
      if (ip.startsWith("127.") || ip.startsWith("0.")) return;
      found.add(ip);
    };

    void pc
      .createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish());

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        window.clearTimeout(timer);
        finish();
      }
    };
  });
}

async function probeEchoEndpoint(host: string, port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const paths =
    port === 3050
      ? ["/spy/status", "/api/survey/echo/codes", "/health"]
      : ["/api/survey/echo/codes"];

  try {
    for (const path of paths) {
      try {
        const res = await fetch(`http://${host}:${port}${path}`, {
          signal: controller.signal,
          cache: "no-store",
          mode: "cors",
        });
        if (!res.ok) continue;
        if (path === "/health") return true;
        const payload = (await res.json()) as { ok?: boolean; echoNodeId?: string; source?: string };
        if (payload.ok === true) return true;
        if (payload.source === "echo-satellite") return true;
        if (typeof payload.echoNodeId === "string" && payload.echoNodeId.length > 0) return true;
      } catch {
        /* try next path */
      }
    }
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Scan the local /24 for Echo Satellite (3050) or cyberdeck (3000) from the browser. */
export async function discoverEchoEndpointsOnLan(hintHosts: string[] = []): Promise<EchoEndpoint[]> {
  if (typeof window === "undefined") return [];

  return Promise.race([
    discoverEchoEndpointsOnLanInner(hintHosts),
    new Promise<EchoEndpoint[]>((resolve) => {
      window.setTimeout(() => resolve([]), PAIR_DISCOVERY_TIMEOUT_MS);
    }),
  ]);
}

async function discoverEchoEndpointsOnLanInner(hintHosts: string[] = []): Promise<EchoEndpoint[]> {
  if (typeof window === "undefined") return [];

  const candidates = new Set<string>(["127.0.0.1", ...hintHosts.filter(Boolean)]);
  for (const ip of await discoverLocalIpv4Addresses()) {
    candidates.add(ip);
    const prefix = subnetPrefixFromIp(ip);
    if (prefix) {
      for (const host of subnetHosts(prefix)) {
        candidates.add(host);
      }
    }
  }

  const found: EchoEndpoint[] = [];
  const seen = new Set<string>();
  const hosts = [...candidates];

  for (let index = 0; index < hosts.length; index += PROBE_BATCH_SIZE) {
    const batch = hosts.slice(index, index + PROBE_BATCH_SIZE);
    const probes = await Promise.all(
      batch.flatMap((host) =>
        PROBE_PORTS.map(async (port) => {
          const key = `${host}:${port}`;
          if (seen.has(key)) return null;
          if (!(await probeEchoEndpoint(host, port))) return null;
          seen.add(key);
          return { host, port } satisfies EchoEndpoint;
        }),
      ),
    );
    for (const endpoint of probes) {
      if (endpoint) found.push(endpoint);
    }
  }

  return found.sort((left, right) => {
    if (left.port === 3050 && right.port !== 3050) return -1;
    if (right.port === 3050 && left.port !== 3050) return 1;
    return left.host.localeCompare(right.host);
  });
}
