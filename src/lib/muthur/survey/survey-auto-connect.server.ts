import type { ToolCall, ToolResult } from "@/lib/muthur-core/types";

const DEFAULT_ECHO_HOST = "127.0.0.1";
const DEFAULT_ECHO_PORT = 3050;

function getStringArg(call: ToolCall, key: string): string {
  const raw = call.args[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function getBoolArg(call: ToolCall, key: string, defaultValue: boolean): boolean {
  const raw = call.args[key];
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

type EchoCodesPreflight = {
  echoReachable: boolean;
  echoHost: string;
  httpPort: number;
  miragePinAvailable: boolean;
  powerfistPinAvailable: boolean;
  pairedMirageCount: number;
  pairedPowerfist: boolean;
  reason?: string;
};

async function preflightEchoSatellite(
  echoHost: string,
  httpPort: number,
): Promise<EchoCodesPreflight> {
  const base: EchoCodesPreflight = {
    echoReachable: false,
    echoHost,
    httpPort,
    miragePinAvailable: false,
    powerfistPinAvailable: false,
    pairedMirageCount: 0,
    pairedPowerfist: false,
  };

  try {
    const res = await fetch(`http://${echoHost}:${httpPort}/api/survey/echo/codes`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      return { ...base, reason: `Echo Satellite HTTP ${res.status}.` };
    }
    const payload = (await res.json()) as {
      ok?: boolean;
      reason?: string;
      miragePin?: string | null;
      powerfistPin?: string | null;
      pairedMirages?: unknown[];
      pairedPowerfist?: unknown | null;
    };
    if (!payload.ok) {
      return { ...base, reason: payload.reason ?? "Echo Survey codes unavailable." };
    }
    return {
      echoReachable: true,
      echoHost,
      httpPort,
      miragePinAvailable: Boolean(payload.miragePin?.trim()),
      powerfistPinAvailable: Boolean(payload.powerfistPin?.trim()),
      pairedMirageCount: Array.isArray(payload.pairedMirages) ? payload.pairedMirages.length : 0,
      pairedPowerfist: Boolean(payload.pairedPowerfist),
    };
  } catch {
    return {
      ...base,
      reason: `Could not reach Echo Satellite at ${echoHost}:${httpPort}. Open Echo Satellite Survey tab first.`,
    };
  }
}

/** MUTHUR tool — queue client-side TEAM LINKS wiring (Echo + Mirage hub + PowerFist). */
export async function runSurveyAutoConnect(call: ToolCall): Promise<ToolResult> {
  const echoHost = getStringArg(call, "echoHost") || DEFAULT_ECHO_HOST;
  const httpPortRaw = call.args.echoHttpPort;
  const httpPort =
    typeof httpPortRaw === "number" && Number.isFinite(httpPortRaw)
      ? httpPortRaw
      : DEFAULT_ECHO_PORT;
  const force = getBoolArg(call, "force", true);

  const preflight = await preflightEchoSatellite(echoHost, httpPort);

  return {
    ok: true,
    output: {
      queued: true,
      force,
      echoHost,
      echoHttpPort: httpPort,
      preflight,
    },
  };
}
