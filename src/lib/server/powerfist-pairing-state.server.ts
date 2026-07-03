import fs from "node:fs/promises";
import path from "node:path";

export type PowerfistPairingSession = {
  pairId: string;
  pairSecret: string;
  /** 6-digit code for same-machine pairing (Survey → PowerFist tab). */
  pin: string;
  expiresAt: string;
};

export type PowerfistPairedRemote = {
  deviceId: string;
  remoteToken: string;
  pairedAt: string;
};

export type PowerfistPairedCapture = {
  nodeId: string;
  captureToken: string;
  pairedAt: string;
  /** Survey node kind — always `echo` for capture desk. */
  label?: string;
};

export type PowerfistPairedMirage = {
  nodeId: string;
  pairedAt: string;
};

export type PowerfistCapturePairingSession = {
  pairId: string;
  pairSecret: string;
  expiresAt: string;
  echoHost?: string;
  echoHttpPort?: number;
};

export type PowerfistPairingState = {
  port: number;
  bindHost: string;
  /** @deprecated use deckToken */
  token?: string;
  deckToken: string;
  lanHosts: string[];
  httpPort?: number;
  updatedAt: string;
  missionSecret?: string;
  pairingSession?: PowerfistPairingSession | null;
  capturePairingSession?: PowerfistCapturePairingSession | null;
  pairedRemote?: PowerfistPairedRemote | null;
  pairedCapture?: PowerfistPairedCapture | null;
  /** This hub's Mirage node identity (solver computer). */
  mirageNode?: PowerfistPairedMirage | null;
};

export function powerfistPairingStatePath(): string {
  return (
    process.env.ECHO_MIRAGE_POWERFIST_STATE_PATH?.trim() ||
    path.join(process.cwd(), ".tmp", "powerfist-ws.json")
  );
}

export function normalizePowerfistPairingState(raw: PowerfistPairingState): PowerfistPairingState {
  return {
    ...raw,
    deckToken: raw.deckToken || raw.token || "",
  };
}

export async function readPowerfistPairingState(): Promise<PowerfistPairingState | null> {
  try {
    const raw = JSON.parse(await fs.readFile(powerfistPairingStatePath(), "utf8")) as PowerfistPairingState;
    return normalizePowerfistPairingState(raw);
  } catch {
    return null;
  }
}

export async function writePowerfistPairingState(state: PowerfistPairingState): Promise<void> {
  const statePath = powerfistPairingStatePath();
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const normalized = normalizePowerfistPairingState(state);
  await fs.writeFile(statePath, JSON.stringify(normalized, null, 2), "utf8");
}
