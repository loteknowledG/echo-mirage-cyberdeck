"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SurveyPairOtpInput } from "@/components/cyberdeck/survey-pair-otp-input";
import { SurveyPairPinCopyHint } from "@/components/cyberdeck/survey-pair-pin-display";
import { SURVEY_ECHO_DISPLAY, SURVEY_MIRAGE_DISPLAY } from "@/lib/cyberdeck/survey-mode";
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
import { fetchSurveyRelayBundle } from "@/lib/cyberdeck/survey-relay.client";
import { emitSurveyPairingDiagnostics, notifySurveyPairingDebug } from "@/lib/cyberdeck/survey-pairing-debug";
import {
  clearSurveyPairPinDraft,
  readSurveyPairPinDraft,
  writeSurveyPairPinDraft,
} from "@/lib/cyberdeck/survey-pair-pin-draft";
import { SURVEY_PAIRING_BUNDLE_EVENT, type SurveyPairingBundlePush } from "@/lib/cyberdeck/survey-team-socket-types";

type SurveyPairPinFormProps = {
  role: "mirage" | "powerfist";
  roleLabel: string;
  focusClassName?: string;
  buttonLabel: string;
  defaultEchoHost?: string | null;
  /** Cloud relay — Echo team ID + code only (PWA / HTTPS). */
  useCloudRelay?: boolean;
  /** When Echo pushes a bundle over the team socket, prefill IP/port/code. */
  pushPrefill?: SurveyPairingBundlePush | null;
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

function readPairingUrlDefaults(): { echoHost: string; echoPort: string; echoNodeId: string } {
  if (typeof window === "undefined") return { echoHost: "", echoPort: "", echoNodeId: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    echoHost: params.get("echoHost")?.trim() ?? "",
    echoPort: params.get("echoPort")?.trim() ?? params.get("echoHttpPort")?.trim() ?? "",
    echoNodeId: params.get("echoNodeId")?.trim() ?? "",
  };
}

function readLastEchoNodeId(role: "mirage" | "powerfist"): string {
  if (role === "mirage") {
    return readSurveyMiragePairCredentials()?.echoNodeId ?? "";
  }
  return readSurveyPowerfistPairCredentials()?.echoNodeId ?? "";
}

function readMirageEchoEndpoint(): { host: string; port: string } | null {
  const mirage = readSurveyMiragePairCredentials();
  if (!mirage?.echoHost?.trim()) return null;
  const formatted = formatEchoEndpointFields(mirage.echoHost, String(mirage.httpPort ?? DEFAULT_ECHO_HTTP_PORT));
  return formatted;
}

function resolveEchoHostForRole(
  role: "mirage" | "powerfist",
  defaultEchoHost?: string | null,
): string {
  const own = readLastEchoHost(role);
  if (own.trim()) return own.trim();
  if (defaultEchoHost?.trim()) return defaultEchoHost.trim();
  if (role === "powerfist") {
    return readMirageEchoEndpoint()?.host ?? "";
  }
  return "";
}

function resolveEchoPortForRole(role: "mirage" | "powerfist", host: string): string {
  if (!host.trim()) return String(DEFAULT_ECHO_HTTP_PORT);
  const own = readLastEchoHost(role);
  if (own.trim()) return readLastEchoPort(role);
  if (role === "powerfist") {
    const mirage = readMirageEchoEndpoint();
    if (mirage?.host) return mirage.port;
  }
  return String(DEFAULT_ECHO_HTTP_PORT);
}

function readInitialPairFormState(
  role: "mirage" | "powerfist",
  defaultEchoHost?: string | null,
  useCloudRelay = false,
): { echoHost: string; echoHttpPort: string; pin: string; echoNodeId: string } {
  const fromUrl = readPairingUrlDefaults();
  const echoNodeId = readLastEchoNodeId(role) || fromUrl.echoNodeId;

  if (useCloudRelay) {
    const draft = readSurveyPairPinDraft(role);
    return {
      echoHost: "",
      echoHttpPort: String(DEFAULT_ECHO_HTTP_PORT),
      pin: draft?.pin ?? "",
      echoNodeId: draft?.echoNodeId || echoNodeId,
    };
  }

  const draft = readSurveyPairPinDraft(role);
  const resolvedHost =
    draft?.echoHost.trim() ||
    resolveEchoHostForRole(role, defaultEchoHost) ||
    fromUrl.echoHost ||
    "";
  const resolvedPort = draft?.echoHttpPort.trim()
    ? draft.echoHttpPort
    : fromUrl.echoPort || resolveEchoPortForRole(role, resolvedHost);

  if (!resolvedHost) {
    return {
      echoHost: "",
      echoHttpPort: String(DEFAULT_ECHO_HTTP_PORT),
      pin: draft?.pin ?? "",
      echoNodeId,
    };
  }

  const formatted = formatEchoEndpointFields(resolvedHost, resolvedPort);
  return {
    echoHost: formatted.host,
    echoHttpPort: formatted.port,
    pin: draft?.pin ?? "",
    echoNodeId,
  };
}

export function SurveyPairPinForm({
  role,
  roleLabel,
  focusClassName,
  buttonLabel,
  defaultEchoHost,
  useCloudRelay = false,
  pushPrefill,
  onPaired,
}: SurveyPairPinFormProps) {
  const [formState, setFormState] = useState(() =>
    readInitialPairFormState(role, defaultEchoHost, useCloudRelay),
  );
  const { echoHost, echoHttpPort, echoNodeId, pin } = formState;
  const setEchoHost = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, echoHost: value }));
  }, []);
  const setEchoHttpPort = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, echoHttpPort: value }));
  }, []);
  const setEchoNodeId = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, echoNodeId: value }));
  }, []);
  const setPin = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, pin: value }));
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    writeSurveyPairPinDraft(role, { echoHost, echoHttpPort, pin, echoNodeId });
  }, [role, echoHost, echoHttpPort, pin, echoNodeId]);

  const pullRelayBundle = useCallback(async (teamId: string) => {
    const id = teamId.trim();
    if (!id) return;
    setStatus("Fetching cloud relay bundle…");
    const relay = await fetchSurveyRelayBundle(id);
    if (!relay.ok) {
      setStatus(null);
      setError(relay.reason);
      return;
    }
    const bundle = relay.bundle;
    const code = role === "mirage" ? bundle.miragePin : bundle.powerfistPin;
    if (code) {
      setPin(normalizeSurveyPairPin(code));
    }
    setEchoHost(bundle.echoHost);
    setEchoHttpPort(String(bundle.httpPort));
    setError(null);
    setStatus("Relay bundle loaded — confirm and pair.");
    notifySurveyPairingDebug(`relay bundle · team ${id.slice(0, 8)}… · pin ${code ? "yes" : "no"}`);
  }, [role]);

  useEffect(() => {
    if (!useCloudRelay || !echoNodeId.trim()) return;
    const timer = window.setTimeout(() => {
      void pullRelayBundle(echoNodeId);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [useCloudRelay, echoNodeId, pullRelayBundle]);

  useEffect(() => {
    if (useCloudRelay || role !== "powerfist") return;
    const mirage = readMirageEchoEndpoint();
    if (!mirage?.host || echoHost.trim()) return;
    setFormState((prev) => ({
      ...prev,
      echoHost: mirage.host,
      echoHttpPort: mirage.port,
    }));
    setError(null);
    setStatus(`Echo endpoint copied from linked ${SURVEY_MIRAGE_DISPLAY}.`);
  }, [role, useCloudRelay, echoHost]);

  useEffect(() => {
    if (!pushPrefill?.echoHost) return;
    const code = role === "mirage" ? pushPrefill.miragePin : pushPrefill.powerfistPin;
    if (!code) return;
    const formatted = formatEchoEndpointFields(
      pushPrefill.echoHost,
      String(pushPrefill.httpPort ?? DEFAULT_ECHO_HTTP_PORT),
    );
    setEchoHost(formatted.host);
    setEchoHttpPort(formatted.port);
    setPin(normalizeSurveyPairPin(code));
    setError(null);
    setStatus("Pairing details received from Echo — confirm and pair.");
    notifySurveyPairingDebug(
      `form prefilled from team socket · ${formatted.host}:${formatted.port}`,
    );
  }, [pushPrefill, role]);

  useEffect(() => {
    const onBundle = (event: Event) => {
      const detail = (event as CustomEvent<SurveyPairingBundlePush>).detail;
      if (!detail?.echoHost) return;
      const code = role === "mirage" ? detail.miragePin : detail.powerfistPin;
      if (!code) return;
      const formatted = formatEchoEndpointFields(
        detail.echoHost,
        String(detail.httpPort ?? DEFAULT_ECHO_HTTP_PORT),
      );
      setEchoHost(formatted.host);
      setEchoHttpPort(formatted.port);
      setPin(normalizeSurveyPairPin(code));
      setError(null);
      setStatus("Pairing details received from Echo — confirm and pair.");
    };
    window.addEventListener(SURVEY_PAIRING_BUNDLE_EVENT, onBundle);
    return () => window.removeEventListener(SURVEY_PAIRING_BUNDLE_EVENT, onBundle);
  }, [role]);

  const syncEndpointFields = useCallback((hostInput: string, portInput: string) => {
    const formatted = formatEchoEndpointFields(hostInput, portInput);
    setFormState((prev) => ({
      ...prev,
      echoHost: formatted.host,
      echoHttpPort: formatted.port,
    }));
    return formatted;
  }, []);

  const handlePinChange = useCallback(
    (next: string) => {
      setPin(normalizeSurveyPairPin(next));
    },
    [setPin],
  );

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
    if (!isValidSurveyPairPin(pin)) {
      setError(`Enter the 6-digit ${roleLabel} code from Echo.`);
      return;
    }

    if (useCloudRelay) {
      const teamId = echoNodeId.trim();
      if (!teamId) {
        setError(`Enter ${SURVEY_ECHO_DISPLAY} team ID from Echo Satellite.`);
        return;
      }
      setBusy(true);
      setError(null);
      setStatus("Pairing via cloud relay…");
      notifySurveyPairingDebug(`relay pair · ${roleLabel} · team ${teamId.slice(0, 8)}…`);
      const result = await enterSurveyPairPin({
        echoNodeId: teamId,
        echoHttpPort: DEFAULT_ECHO_HTTP_PORT,
        pin,
        role,
      });
      setBusy(false);
      if (!result.ok) {
        setStatus(null);
        setError(result.reason);
        notifySurveyPairingDebug(`pair failed — ${result.reason}`);
        void emitSurveyPairingDiagnostics("after relay pair failure");
        return;
      }
      if (result.role !== role) {
        setStatus(null);
        setError(`That code is for ${result.role === "mirage" ? "Mirage" : "PowerFist"}, not ${roleLabel}.`);
        return;
      }
      onPaired(result);
      setPin("");
      clearSurveyPairPinDraft(role);
      setError(null);
      setStatus(`Linked with ${SURVEY_ECHO_DISPLAY} via cloud relay.`);
      return;
    }

    let { host, port: portText } = syncEndpointFields(echoHost, echoHttpPort);

    if (!host.trim() && role === "powerfist") {
      const mirage = readMirageEchoEndpoint();
      if (mirage?.host) {
        host = mirage.host;
        portText = mirage.port;
        syncEndpointFields(host, portText);
      }
    }

    const port = Number(portText);

    if (!host.trim()) {
      setError(`Enter ${SURVEY_ECHO_DISPLAY} IP address (Echo Satellite on the screenshot Mac).`);
      return;
    }
    if (!Number.isFinite(port) || port <= 0) {
      setError("Enter a valid Echo port.");
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
    clearSurveyPairPinDraft(role);
    setError(null);
    setStatus(`Linked with ${SURVEY_ECHO_DISPLAY} at ${result.echoHost}:${result.httpPort}.`);
    syncEndpointFields(result.echoHost, String(result.httpPort));
  }, [
    echoHost,
    echoHttpPort,
    echoNodeId,
    pin,
    role,
    roleLabel,
    onPaired,
    syncEndpointFields,
    useCloudRelay,
  ]);

  const resolvedPreview = formatEchoEndpointFields(echoHost, echoHttpPort);

  const inputClassName =
    "border border-fuchsia-800/50 bg-[#0a0a0a] px-2 py-2.5 font-mono text-[11px] tracking-[0.04em] text-[#e8e8e8] outline-none focus:border-fuchsia-500/70";

  return (
    <section
      className="flex flex-col gap-4 rounded border border-fuchsia-950/50 bg-fuchsia-950/5 p-3"
      aria-label="Echo Satellite pairing"
    >
      <p className="text-[10px] font-semibold tracking-[0.12em] text-fuchsia-300/90">
        {useCloudRelay ? `${SURVEY_ECHO_DISPLAY} CLOUD RELAY` : `${SURVEY_ECHO_DISPLAY} SATELLITE`}
      </p>

      {useCloudRelay ? (
        <label className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.08em] text-[#b8b8b8]">{SURVEY_ECHO_DISPLAY} team ID</span>
          <input
            value={echoNodeId}
            onChange={(event) => setEchoNodeId(event.target.value.trim())}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder="uuid from Echo Satellite"
            className={inputClassName}
          />
          <span className="text-[8px] leading-relaxed text-[#7a7a7a]">
            Copy from Echo Satellite → Survey pairing codes. Relay auto-loads the Mirage code when Echo
            has pushed a bundle.
          </span>
          <CyberdeckActionButton
            disabled={busy || !echoNodeId.trim()}
            onClick={() => void pullRelayBundle(echoNodeId)}
          >
            Refresh from relay
          </CyberdeckActionButton>
        </label>
      ) : (
        <>
      <label className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.08em] text-[#b8b8b8]">{SURVEY_ECHO_DISPLAY} IP address</span>
        <input
          value={echoHost}
          onChange={(event) => handleAddressChange(event.target.value)}
          onBlur={handleAddressBlur}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder="e.g. 127.0.0.1 or 100.66.91.18"
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
        </>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">{roleLabel} pairing code</span>
        <SurveyPairOtpInput
          value={pin}
          onChange={handlePinChange}
          disabled={busy}
          focusClassName={focusClassName}
        />
        <SurveyPairPinCopyHint pin={pin} />
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
