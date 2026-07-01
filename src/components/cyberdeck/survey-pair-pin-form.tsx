"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SurveyPairOtpInput } from "@/components/cyberdeck/survey-pair-otp-input";
import { SURVEY_ECHO_DISPLAY } from "@/lib/cyberdeck/survey-mode";
import {
  DEFAULT_ECHO_HTTP_PORT,
  formatEchoEndpointFields,
  isValidSurveyPairPin,
  normalizeSurveyPairPin,
} from "@/lib/cyberdeck/survey-pair-pin";
import {
  enterSurveyPairPin,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { emitSurveyPairingDiagnostics, notifySurveyPairingDebug } from "@/lib/cyberdeck/survey-pairing-debug";

type SurveyPairPinFormProps = {
  role: "mirage" | "powerfist";
  roleLabel: string;
  focusClassName?: string;
  buttonLabel: string;
  defaultEchoHost?: string | null;
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
    return readSurveyMiragePairCredentials()?.echoHost ?? "";
  }
  return readSurveyPowerfistPairCredentials()?.echoHost ?? "";
}

function readLastEchoPort(role: "mirage" | "powerfist"): string {
  const creds =
    role === "mirage" ? readSurveyMiragePairCredentials() : readSurveyPowerfistPairCredentials();
  return creds?.httpPort ? String(creds.httpPort) : String(DEFAULT_ECHO_HTTP_PORT);
}

function shouldNormalizeAddressInput(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || /:\d{1,5}$/.test(trimmed);
}

export function SurveyPairPinForm({
  role,
  roleLabel,
  focusClassName,
  buttonLabel,
  defaultEchoHost,
  onPaired,
}: SurveyPairPinFormProps) {
  const [echoHost, setEchoHost] = useState("");
  const [echoHttpPort, setEchoHttpPort] = useState(String(DEFAULT_ECHO_HTTP_PORT));
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const lastHost = readLastEchoHost(role) || defaultEchoHost?.trim() || "";
    if (!lastHost) return;
    const formatted = formatEchoEndpointFields(lastHost, readLastEchoPort(role));
    setEchoHost(formatted.host);
    setEchoHttpPort(formatted.port);
  }, [role, defaultEchoHost]);

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
    setPin(normalizeSurveyPairPin(next));
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

    if (!host.trim()) {
      setError(`Enter ${SURVEY_ECHO_DISPLAY} IP address (Echo Satellite on the screenshot Mac).`);
      return;
    }
    if (!Number.isFinite(port) || port <= 0) {
      setError("Enter a valid Echo port.");
      return;
    }
    if (!isValidSurveyPairPin(pin)) {
      setError(`Enter the 6-digit ${roleLabel} code from Echo.`);
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(`Pairing with ${host}:${port}…`);
    notifySurveyPairingDebug(`pair button · ${roleLabel} · target ${host}:${port}`);

    const hintHosts = [host, readLastEchoHost(role)].filter(Boolean);
    const result = await enterSurveyPairPin({
      echoHost: host,
      echoHttpPort: port,
      pin,
      role,
      hintHosts,
    });
    setBusy(false);

    if (!result.ok) {
      setStatus(null);
      setError(result.reason);
      notifySurveyPairingDebug(`pair failed — ${result.reason}`);
      void emitSurveyPairingDiagnostics("after pair failure");
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
    setStatus(`Linked with ${SURVEY_ECHO_DISPLAY} at ${result.echoHost}:${result.httpPort}.`);
    syncEndpointFields(result.echoHost, String(result.httpPort));
  }, [echoHost, echoHttpPort, pin, role, roleLabel, onPaired, syncEndpointFields]);

  const resolvedPreview = formatEchoEndpointFields(echoHost, echoHttpPort);

  const inputClassName =
    "border border-fuchsia-800/50 bg-[#0a0a0a] px-2 py-2.5 font-mono text-[11px] tracking-[0.04em] text-[#e8e8e8] outline-none focus:border-fuchsia-500/70";

  return (
    <section
      className="flex flex-col gap-4 rounded border border-fuchsia-950/50 bg-fuchsia-950/5 p-3"
      aria-label="Echo Satellite pairing"
    >
      <p className="text-[10px] font-semibold tracking-[0.12em] text-fuchsia-300/90">
        {SURVEY_ECHO_DISPLAY} SATELLITE
      </p>

      <label className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.08em] text-[#b8b8b8]">{SURVEY_ECHO_DISPLAY} IP address</span>
        <input
          value={echoHost}
          onChange={(event) => handleAddressChange(event.target.value)}
          onBlur={handleAddressBlur}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder="100.66.91.18"
          className={inputClassName}
        />
        <span className="text-[8px] leading-relaxed text-[#7a7a7a]">
          Tailscale or LAN IP of the Echo Mac. Paste <code className="text-fuchsia-300/80">100.66.91.18:3050</code>{" "}
          to fill port automatically.
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.08em] text-[#b8b8b8]">{SURVEY_ECHO_DISPLAY} port</span>
        <input
          value={echoHttpPort}
          onChange={(event) => setEchoHttpPort(event.target.value.replace(/\D/g, "").slice(0, 5))}
          onBlur={handleAddressBlur}
          inputMode="numeric"
          spellCheck={false}
          autoComplete="off"
          placeholder={String(DEFAULT_ECHO_HTTP_PORT)}
          className={`w-28 ${inputClassName}`}
        />
      </label>

      {resolvedPreview.host ? (
        <p className="text-[8px] text-[#6a8a8a]">
          Will connect to{" "}
          <code className="text-[#9fd8ff]">
            {resolvedPreview.host}:{resolvedPreview.port}
          </code>
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">{roleLabel} pairing code</span>
        <SurveyPairOtpInput
          value={pin}
          onChange={handlePinChange}
          disabled={busy}
          focusClassName={focusClassName}
        />
      </div>

      <CyberdeckActionButton disabled={busy} onClick={() => void handlePair()}>
        {busy ? (status ?? "Pairing…") : buttonLabel}
      </CyberdeckActionButton>

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
    </section>
  );
}
