"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  ESPIONAGE_MODE_TITLE,
  ESPIONAGE_POWERFIST_LABEL,
  ESPIONAGE_POWERFIST_TAGLINE,
} from "@/lib/cyberdeck/espionage-mode";
import { fetchPowerfistQrSession } from "@/lib/cyberdeck/powerfist-remote-socket";

export function SpyPowerfistPane() {
  const [phonePaired, setPhonePaired] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const session = await fetchPowerfistQrSession();
      if (!session.ok) {
        setPhonePaired(false);
        return;
      }
      setPhonePaired(Boolean(session.pairedRemote?.deviceId));
    })();
  }, []);

  const handleTriggerMission = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/spy/trigger-mission", { method: "POST" });
      const payload = (await res.json()) as {
        ok?: boolean;
        missionId?: string;
        reason?: string;
      };
      if (!payload.ok) {
        setError(payload.reason || "Mission trigger failed.");
        return;
      }
      setStatus(`Mission ${payload.missionId?.slice(0, 8) ?? "—"}… dispatched to Echo.`);
    } catch {
      setError("Trigger request failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <div>
        <p className="text-amber-200/90">{ESPIONAGE_MODE_TITLE} // {ESPIONAGE_POWERFIST_LABEL}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{ESPIONAGE_POWERFIST_TAGLINE}</p>
      </div>

      <p className="text-[9px] text-[#5f5f5f]">
        Phone status:{" "}
        {phonePaired === null ? "…" : phonePaired ? "PAIRED" : "NOT PAIRED"} — pair via Mirage hub QR.
      </p>

      <div className="flex flex-wrap gap-2">
        <CyberdeckActionButton disabled={busy} onClick={() => void handleTriggerMission()}>
          Test Espionage capture
        </CyberdeckActionButton>
        <Link
          href="/preview"
          className="inline-flex items-center rounded border border-[#2d2d2d] px-3 py-1.5 text-[9px] tracking-[0.08em] text-[#8a8a8a] hover:text-[#cfcfcf]"
        >
          Open PowerFist PWA
        </Link>
      </div>

      <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
        On your phone: open the PowerFist preview PWA (same Wi‑Fi), scan the Mirage PowerFist QR,
        then push <strong className="font-normal text-[#8a8a8a]">Espionage Capture</strong> on the
        Execution Deck.
      </p>

      {status ? <p className="text-emerald-300/80">{status}</p> : null}
      {error ? <p className="text-red-300/90">{error}</p> : null}
    </div>
  );
}
