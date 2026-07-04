"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SURVEY_HUB_NOTICE, isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import {
  readSurveyHubTeamId,
  resolveSurveyHubTeamId,
  saveSurveyHubTeamId,
} from "@/lib/cyberdeck/survey-hub-store.client";
import {
  formatSurveyHubResultForMuthur,
  runSurveyHubConnect,
} from "@/lib/cyberdeck/survey-hub.client";
import { isSurveyTeamTripleLinked } from "@/lib/cyberdeck/survey-team-status";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import { SURVEY_ECHO_DISPLAY } from "@/lib/cyberdeck/survey-mode";
import { notifySpyMuthurArchive } from "@/lib/cyberdeck/survey-chat";

/** Survey Hub — one team ID, one Connect button, all three links. */
export function SurveyHubPanel() {
  const team = useSurveyTeamStatus();
  const tripleLinked = isSurveyTeamTripleLinked(team);
  const hubEnabled = isSurveyHubEnabled();

  const [teamId, setTeamId] = useState(() => resolveSurveyHubTeamId() ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = readSurveyHubTeamId();
    if (saved && !teamId.trim()) {
      setTeamId(saved);
    }
  }, [teamId]);

  const handleConnect = useCallback(
    async (quiet = false) => {
      if (!hubEnabled) return;
      const id = teamId.trim();
      if (id) saveSurveyHubTeamId(id);

      setBusy(true);
      setError(null);
      setStatus(quiet ? null : "Connecting team…");

      const result = await runSurveyHubConnect({
        echoNodeId: id || undefined,
        force: true,
        quiet,
      });

      setBusy(false);
      notifySpyMuthurArchive(formatSurveyHubResultForMuthur(result));

      if (!result.ran) {
        setStatus(null);
        setError(result.skipped ?? "Could not connect.");
        return;
      }

      const failed = result.steps.filter((step) => !step.ok).length;
      if (failed === 0) {
        setStatus("All team links connected.");
        setError(null);
      } else {
        setStatus(null);
        setError(`${failed} link(s) failed — open ${SURVEY_ECHO_DISPLAY} Survey tab and retry.`);
      }
    },
    [hubEnabled, teamId],
  );

  useEffect(() => {
    if (!hubEnabled || team.loading || tripleLinked) return;
    let cancelled = false;
    void (async () => {
      const saved = resolveSurveyHubTeamId();
      if (!saved || cancelled) return;
      setBusy(true);
      const result = await runSurveyHubConnect({ echoNodeId: saved, force: true, quiet: true });
      setBusy(false);
      if (!cancelled && result.ran && result.steps.every((step) => step.ok)) {
        setStatus("All team links connected.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hubEnabled, team.loading, tripleLinked]);

  if (!hubEnabled) {
    return null;
  }

  if (tripleLinked) {
    return (
      <div className="shrink-0 border-b border-emerald-900/50 bg-emerald-950/20 px-4 py-2.5 font-mono">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-emerald-300">
          SURVEY HUB // TEAM CONNECTED
        </p>
        <p className="mt-0.5 text-[8px] text-emerald-300/75">
          Echo ↔ Mirage ↔ PowerFist · {team.echoHost ?? "relay"}
          {readSurveyHubTeamId() ? ` · team ${readSurveyHubTeamId()!.slice(0, 8)}…` : null}
        </p>
      </div>
    );
  }

  return (
    <section className="shrink-0 border-b border-cyan-950/50 bg-cyan-950/15 px-4 py-3 font-mono">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-cyan-200/95">SURVEY HUB</p>
      <p className="mt-1 text-[8px] leading-relaxed text-[#8aabb8]">{SURVEY_HUB_NOTICE}</p>

      <div className="mt-3 flex flex-col gap-2">
        <label className="text-[8px] tracking-[0.08em] text-[#8aabb8]">
          Echo team ID <span className="text-[#5f7f8f]">(from Echo Satellite — saved after first connect)</span>
        </label>
        <input
          type="text"
          value={teamId}
          onChange={(event) => setTeamId(event.target.value.trim())}
          placeholder="e.g. a1b2c3d4-…"
          className="rounded border border-[#2a3a3a] bg-black px-3 py-2 text-[10px] text-[#e0f0f0] outline-none focus:border-cyan-600/60"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CyberdeckActionButton disabled={busy} onClick={() => void handleConnect(false)}>
          {busy ? "Connecting…" : "Connect team"}
        </CyberdeckActionButton>
        <p className="text-[8px] text-[#6a8a9a]">
          Same machine? Leave team ID blank — Hub finds Echo on localhost.
        </p>
      </div>

      {status ? <p className="mt-2 text-[9px] text-emerald-300/90">{status}</p> : null}
      {error ? <p className="mt-2 text-[9px] text-amber-300/90">{error}</p> : null}
    </section>
  );
}
