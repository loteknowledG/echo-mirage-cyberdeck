"use client";

import { useCallback, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SpyPairOtpInput } from "@/components/cyberdeck/spy-pair-otp-input";
import {
  ESPIONAGE_ECHO_DISPLAY,
} from "@/lib/cyberdeck/espionage-mode";
import { isValidSpyPairPin, normalizeSpyPairPin, parseEchoEndpointInput } from "@/lib/cyberdeck/spy-pair-pin";
import {
  enterSpyPairPin,
  readSpyMiragePairCredentials,
  readSpyPowerfistPairCredentials,
} from "@/lib/cyberdeck/spy-pairing-client";

const DEFAULT_ECHO_HTTP_PORT = 3050;

function resolveEchoEndpoint(hostInput: string, portInput: string) {
  const fallbackPort = Number(portInput.trim() || DEFAULT_ECHO_HTTP_PORT);
  const parsed = parseEchoEndpointInput(hostInput, fallbackPort);
  return parsed;
}

type SpyPairPinFormProps = {
  role: "mirage" | "powerfist";
  roleLabel: string;
  focusClassName?: string;
  buttonLabel: string;
  onPaired: (result: {
    echoHost: string;
    httpPort: number;
    echoNodeId: string;
    token: string;
    nodeId?: string;
    deviceId?: string;
    sessionEpoch: number;
  }) => void;
};

function readLastEchoHost(role: "mirage" | "powerfist"): string {
  if (role === "mirage") {
    return readSpyMiragePairCredentials()?.echoHost ?? "";
  }
  return readSpyPowerfistPairCredentials()?.echoHost ?? "";
}

export function SpyPairPinForm({
  role,
  roleLabel,
  focusClassName,
  buttonLabel,
  onPaired,
}: SpyPairPinFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [echoHost, setEchoHost] = useState("");
  const [echoHttpPort, setEchoHttpPort] = useState(String(DEFAULT_ECHO_HTTP_PORT));
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handlePinChange = useCallback((next: string) => {
    setPin(normalizeSpyPairPin(next));
  }, []);

  const handlePair = useCallback(async () => {
    const { host, port } = resolveEchoEndpoint(echoHost, echoHttpPort);

    if (!Number.isFinite(port) || port <= 0) {
      setError("Enter a valid Echo port.");
      return;
    }
    if (!isValidSpyPairPin(pin)) {
      setError(`Enter the 6-digit ${roleLabel} code from Echo.`);
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(host ? `Pairing with ${host}:${port}…` : "Searching for Echo on your LAN…");

    const hintHosts = [host, readLastEchoHost(role)].filter(Boolean);
    const result = await enterSpyPairPin({
      echoHost: host || undefined,
      echoHttpPort: port,
      pin,
      role,
      hintHosts,
    });
    setBusy(false);

    if (!result.ok) {
      setStatus(null);
      setError(result.reason);
      return;
    }

    if (result.role !== role) {
      setStatus(null);
      setError(`That code is for ${result.role === "mirage" ? "Mirage" : "PowerFist"}, not ${roleLabel}.`);
      return;
    }

    onPaired(result);
    setPin("");
    setError(null);
    setStatus(`Linked with ${ESPIONAGE_ECHO_DISPLAY} at ${result.echoHost}.`);
  }, [echoHost, echoHttpPort, pin, role, roleLabel, onPaired]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">{roleLabel} pairing code</span>
        <SpyPairOtpInput
          value={pin}
          onChange={handlePinChange}
          disabled={busy}
          focusClassName={focusClassName}
        />
      </div>

      <CyberdeckActionButton disabled={busy} onClick={() => void handlePair()}>
        {busy ? (status ?? "Pairing…") : buttonLabel}
      </CyberdeckActionButton>

      <button
        type="button"
        className="self-start text-[9px] tracking-[0.08em] text-[#6a6a6a] underline-offset-2 hover:text-[#9a9a9a] hover:underline"
        onClick={() => setShowAdvanced((open) => !open)}
      >
        {showAdvanced ? "Hide advanced" : "Advanced — enter Echo IP manually"}
      </button>

      {showAdvanced ? (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">{ESPIONAGE_ECHO_DISPLAY} address</span>
            <input
              value={echoHost}
              onChange={(event) => setEchoHost(event.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              placeholder="192.168.12.39 or 192.168.12.39:3050"
              className="border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none focus:border-[#3d3d3d]"
            />
            <span className="text-[8px] leading-relaxed text-[#5f5f5f]">
              IP only, or include :3050 once — do not put the port in both fields.
            </span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">{ESPIONAGE_ECHO_DISPLAY} port</span>
            <input
              value={echoHttpPort}
              onChange={(event) => setEchoHttpPort(event.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              placeholder={String(DEFAULT_ECHO_HTTP_PORT)}
              className="w-24 border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none focus:border-[#3d3d3d]"
            />
          </label>
        </>
      ) : null}

      {status && !error ? <p className="text-emerald-300/80">{status}</p> : null}
      {error ? <p className="text-red-300/90">{error}</p> : null}
    </div>
  );
}
