"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SpyPairOtpInput } from "@/components/cyberdeck/spy-pair-otp-input";
import { ESPIONAGE_ECHO_DISPLAY } from "@/lib/cyberdeck/espionage-mode";
import {
  DEFAULT_ECHO_HTTP_PORT,
  formatEchoEndpointFields,
  isValidSpyPairPin,
  normalizeSpyPairPin,
} from "@/lib/cyberdeck/spy-pair-pin";
import {
  enterSpyPairPin,
  readSpyMiragePairCredentials,
  readSpyPowerfistPairCredentials,
} from "@/lib/cyberdeck/spy-pairing-client";

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

function readLastEchoPort(role: "mirage" | "powerfist"): string {
  const creds =
    role === "mirage" ? readSpyMiragePairCredentials() : readSpyPowerfistPairCredentials();
  return creds?.httpPort ? String(creds.httpPort) : String(DEFAULT_ECHO_HTTP_PORT);
}

function shouldNormalizeAddressInput(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || /:\d{1,5}$/.test(trimmed);
}

export function SpyPairPinForm({
  role,
  roleLabel,
  focusClassName,
  buttonLabel,
  onPaired,
}: SpyPairPinFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(readLastEchoHost(role)));
  const [echoHost, setEchoHost] = useState("");
  const [echoHttpPort, setEchoHttpPort] = useState(String(DEFAULT_ECHO_HTTP_PORT));
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const lastHost = readLastEchoHost(role);
    if (!lastHost) return;
    const formatted = formatEchoEndpointFields(lastHost, readLastEchoPort(role));
    setEchoHost(formatted.host);
    setEchoHttpPort(formatted.port);
  }, [role]);

  const syncEndpointFields = useCallback(
    (hostInput: string, portInput: string) => {
      const formatted = formatEchoEndpointFields(hostInput, portInput);
      setEchoHost(formatted.host);
      setEchoHttpPort(formatted.port);
      return formatted;
    },
    [],
  );

  const handlePinChange = useCallback((next: string) => {
    setPin(normalizeSpyPairPin(next));
  }, []);

  const handleAddressChange = useCallback(
    (value: string) => {
      setEchoHost(value);
      if (shouldNormalizeAddressInput(value)) {
        syncEndpointFields(value, echoHttpPort);
      }
    },
    [echoHttpPort, syncEndpointFields],
  );

  const handleAddressBlur = useCallback(() => {
    syncEndpointFields(echoHost, echoHttpPort);
  }, [echoHost, echoHttpPort, syncEndpointFields]);

  const handlePair = useCallback(async () => {
    const { host, port: portText } = syncEndpointFields(echoHost, echoHttpPort);
    const port = Number(portText);

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
    setStatus(`Linked with ${ESPIONAGE_ECHO_DISPLAY} at ${result.echoHost}:${result.httpPort}.`);
    syncEndpointFields(result.echoHost, String(result.httpPort));
  }, [echoHost, echoHttpPort, pin, role, roleLabel, onPaired, syncEndpointFields]);

  const resolvedPreview =
    echoHost.trim().length > 0
      ? formatEchoEndpointFields(echoHost, echoHttpPort)
      : null;

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
              onChange={(event) => handleAddressChange(event.target.value)}
              onBlur={handleAddressBlur}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              placeholder="192.168.12.39"
              className="border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none focus:border-[#3d3d3d]"
            />
            <span className="text-[8px] leading-relaxed text-[#5f5f5f]">
              IP or paste <code className="text-[#8a8a8a]">192.168.12.39:3050</code> — port moves to the field
              below automatically.
            </span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">{ESPIONAGE_ECHO_DISPLAY} port</span>
            <input
              value={echoHttpPort}
              onChange={(event) => setEchoHttpPort(event.target.value.replace(/\D/g, "").slice(0, 5))}
              onBlur={handleAddressBlur}
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              placeholder={String(DEFAULT_ECHO_HTTP_PORT)}
              className="w-24 border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none focus:border-[#3d3d3d]"
            />
          </label>

          {resolvedPreview?.host ? (
            <p className="text-[8px] text-[#6a8a8a]">
              Will connect to{" "}
              <code className="text-[#9fd8ff]">
                {resolvedPreview.host}:{resolvedPreview.port}
              </code>
            </p>
          ) : null}
        </>
      ) : null}

      {status && !error ? (
        <p className="rounded border border-emerald-950/40 bg-emerald-950/10 px-3 py-2 text-[9px] text-emerald-300/90">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="rounded border border-red-950/40 bg-red-950/10 px-3 py-2 text-[9px] text-red-300/90">
          {error}
        </p>
      ) : null}
    </div>
  );
}
