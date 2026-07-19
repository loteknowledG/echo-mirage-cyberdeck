"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CyberdeckFilterButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SurveyMirageCapturePreview } from "@/components/cyberdeck/survey-mirage-capture-preview";
import { SurveyMirageExtCapturePanel } from "@/components/cyberdeck/survey-mirage-ext-capture-panel";
import { SurveyMirageQueueTeamHost } from "@/components/cyberdeck/survey-mirage-queue-sync";
import { SurveyPairPinForm } from "@/components/cyberdeck/survey-pair-pin-form";
import { SurveySolutionsPanel } from "@/components/cyberdeck/survey-solutions-panel";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { saveSurveyMiragePairCredentials } from "@/lib/cyberdeck/survey-pair-credentials.client";
import {
  DEFAULT_ECHO_TAILSCALE_HOST,
  preferMeshEchoHost,
} from "@/lib/cyberdeck/survey-pair-pin";
import { isSurveyHttpsPairBlocked } from "@/lib/cyberdeck/survey-pairing-shared.client";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

/** Lazy so Survey pane chunk never hard-depends on listening/mic UI. */
const SurveyMirageListeningPanel = dynamic(
  () =>
    import("@/components/cyberdeck/survey-mirage-listening-panel").then((m) => ({
      default: m.SurveyMirageListeningPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-[9px] tracking-[0.08em] text-[#5f5f5f]">LISTENING // loading…</p>
    ),
  },
);

type SurveyMirageWorkflow = "screenshot" | "extension" | "listening";

const WORKFLOW_STORAGE_KEY = "echo-mirage-survey-mirage-workflow-v2";

function readStoredWorkflow(): SurveyMirageWorkflow {
  if (typeof window === "undefined") return "screenshot";
  const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
  if (raw === "extension" || raw === "listening" || raw === "screenshot") return raw;
  // Migrate v1 key once.
  try {
    const legacy = window.localStorage.getItem("echo-mirage-survey-mirage-workflow-v1");
    if (legacy === "extension") return "extension";
  } catch {
    /* ignore */
  }
  return "screenshot";
}

/**
 * Mirage Survey sub-pane — capture via cloud relay (HTTPS PWA) or direct Echo (LAN).
 */
export function SurveyMiragePane() {
  const { paired, terminated, resetLinkWatch } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);
  const [pwaBlocked, setPwaBlocked] = useState(false);
  const [workflow, setWorkflow] = useState<SurveyMirageWorkflow>("screenshot");

  useEffect(() => {
    setPwaBlocked(isSurveyHttpsPairBlocked());
    setWorkflow(readStoredWorkflow());
  }, []);

  const selectWorkflow = useCallback((next: SurveyMirageWorkflow) => {
    setWorkflow(next);
    try {
      window.localStorage.setItem(WORKFLOW_STORAGE_KEY, next);
    } catch {
      /* ignore quota */
    }
  }, []);

  const handlePaired = useCallback(
    (result: {
      echoHost: string;
      httpPort: number;
      echoNodeId: string;
      token: string;
      nodeId?: string;
      sessionEpoch: number;
    }) => {
      // Satellite often reports LAN IP; keep Tailscale mesh host for Windows Mirage.
      const echoHost =
        preferMeshEchoHost(result.echoHost) ?? DEFAULT_ECHO_TAILSCALE_HOST;
      saveSurveyMiragePairCredentials({
        echoHost,
        httpPort: result.httpPort,
        echoNodeId: result.echoNodeId,
        mirageToken: result.token,
        nodeId: result.nodeId ?? "",
        sessionEpoch: result.sessionEpoch,
        pairedAt: new Date().toISOString(),
      });
      resetLinkWatch();
      notifySurveyTeamStatusChanged();
      void team.refresh();
    },
    [resetLinkWatch, team],
  );

  return (
    <div
      className="flex flex-col gap-3 p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]"
      data-survey-role="mirage"
      data-survey-runtime="browser"
    >
      <SurveyMirageQueueTeamHost role="mirage" />

      {!mirageLinked && !terminated && !pwaBlocked ? (
        <SurveyPairPinForm
          role="mirage"
          roleLabel={SURVEY_MIRAGE_DISPLAY}
          buttonLabel={`Pair with ${SURVEY_ECHO_DISPLAY}`}
          defaultEchoHost={DEFAULT_ECHO_TAILSCALE_HOST}
          onPaired={handlePaired}
        />
      ) : null}

      {mirageLinked && !pwaBlocked ? (
        <p className="text-[9px] text-emerald-300/80">
          LINKED // {SURVEY_ECHO_DISPLAY}
          {paired?.echoHost ? ` · ${paired.echoHost}:${paired.httpPort}` : null}
        </p>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Mirage capture workflow"
        data-testid="survey-mirage-workflow-toggle"
      >
        <p className="text-[9px] tracking-[0.1em] text-fuchsia-300/90">WORKFLOW</p>
        <CyberdeckFilterButton
          active={workflow === "screenshot"}
          role="tab"
          aria-selected={workflow === "screenshot"}
          onClick={() => selectWorkflow("screenshot")}
          data-testid="survey-mirage-workflow-screenshot"
        >
          SCREENSHOT
        </CyberdeckFilterButton>
        <CyberdeckFilterButton
          active={workflow === "extension"}
          role="tab"
          aria-selected={workflow === "extension"}
          onClick={() => selectWorkflow("extension")}
          data-testid="survey-mirage-workflow-extension"
        >
          EXTENSION
        </CyberdeckFilterButton>
        <CyberdeckFilterButton
          active={workflow === "listening"}
          role="tab"
          aria-selected={workflow === "listening"}
          onClick={() => selectWorkflow("listening")}
          data-testid="survey-mirage-workflow-listening"
        >
          LISTENING
        </CyberdeckFilterButton>
      </div>

      {workflow === "screenshot" ? (
        <SurveyMirageCapturePreview />
      ) : workflow === "extension" ? (
        <SurveyMirageExtCapturePanel />
      ) : (
        <SurveyMirageListeningPanel />
      )}

      <div className="border-t border-[#1c1c1c] pt-4">
        <SurveySolutionsPanel />
      </div>
    </div>
  );
}
