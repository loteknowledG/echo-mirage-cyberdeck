"use client";

import { useCallback, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { requestSurveyHubConnectAndWait } from "@/lib/cyberdeck/survey-connect-request.client";
import { formatSurveyHubResultForMuthur } from "@/lib/cyberdeck/survey-hub-connect-events";
import { isSurveyTeamTripleLinked } from "@/lib/cyberdeck/survey-team-status";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import { notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";

/** Compact retry when Survey Hub is on but team links are not green yet. */
export function SurveyHubSubPaneHint() {
  const team = useSurveyTeamStatus();
  const tripleLinked = isSurveyTeamTripleLinked(team);
  const hubEnabled = isSurveyHubEnabled();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRetry = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await requestSurveyHubConnectAndWait({ force: true, quiet: false });
      notifySurveyMuthurArchive(formatSurveyHubResultForMuthur(result));
      if (!result.ran) {
        setMessage(result.skipped ?? "Could not connect.");
        return;
      }
      const failed = result.steps.filter((step) => !step.ok).length;
      if (failed === 0) {
        setMessage("All team links connected.");
      } else {
        setMessage(`${failed} link(s) need attention — check TEAM LINKS above.`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Connect failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!hubEnabled || tripleLinked) {
    return null;
  }

  return (
    <div className="rounded border border-cyan-950/50 bg-cyan-950/10 px-3 py-3 font-mono">
      <p className="text-[9px] leading-relaxed text-[#8aabb8]">
        Survey Hub wires Echo ↔ Mirage ↔ PowerFist. Enter your team ID in SURVEY HUB above, or retry
        connect here.
      </p>
      <div className="mt-2">
        <CyberdeckActionButton disabled={busy || team.loading} onClick={() => void handleRetry()}>
          {busy ? "Connecting…" : "Retry connect"}
        </CyberdeckActionButton>
      </div>
      {message ? <p className="mt-2 text-[9px] text-cyan-200/90">{message}</p> : null}
    </div>
  );
}
