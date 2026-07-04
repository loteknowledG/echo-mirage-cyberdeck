"use client";

import { useEffect } from "react";
import {
  applySurveyEmpLaunchFromUrl,
  isEmpMirageHubConnectSurface,
  isEmpPowerfistHubRestoreSurface,
  markEmpHubConnectTriggered,
  markEmpPowerfistHubRestoreTriggered,
  shouldTriggerEmpHubConnectFromUrl,
} from "@/lib/cyberdeck/survey-emp-launch.client";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { requestSurveyHubConnect } from "@/lib/cyberdeck/survey-connect-request.client";
import { runSurveyMiragePowerfistHubRestore } from "@/lib/cyberdeck/survey-hub.client";

/** Reads ?surveyEmp=echo|mirage|powerfist and opens the Survey tab + EMP sub-pane. */
export function SurveyEmpLaunchHost() {
  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      applySurveyEmpLaunchFromUrl();
    };

    run();
    const retryMs = [400, 1200, 2500];
    const timers = retryMs.map((ms) => window.setTimeout(run, ms));

    if (isSurveyHubEnabled() && shouldTriggerEmpHubConnectFromUrl()) {
      if (isEmpMirageHubConnectSurface() && markEmpHubConnectTriggered()) {
        const connectDelays = [1800, 4500, 9000, 18_000];
        for (const ms of connectDelays) {
          timers.push(
            window.setTimeout(() => {
              if (cancelled) return;
              void requestSurveyHubConnect({ force: true, quiet: false });
            }, ms),
          );
        }
      }

      if (isEmpPowerfistHubRestoreSurface() && markEmpPowerfistHubRestoreTriggered()) {
        const hubRestoreDelays = [6_000, 14_000, 28_000, 45_000, 65_000];
        for (const ms of hubRestoreDelays) {
          timers.push(
            window.setTimeout(() => {
              if (cancelled) return;
              void runSurveyMiragePowerfistHubRestore();
            }, ms),
          );
        }
      }
    }

    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  return null;
}
