"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  appendMuthurDiagnosticEntry,
  type MuthurDiagnosticsState,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import {
  buildMuthurCognitionStatusLine,
  formatMuthurCognitionDiagnosticFromInput,
  recordMuthurCognitionEvent,
  shouldSurfaceCognitionForPosture,
} from "@/lib/muthur/cognition/muthur-cognition-channel";
import { loadMuthurCognition } from "@/lib/muthur/cognition/muthur-cognition-store";
import type {
  MuthurCognitionEmitInput,
  MuthurCognitionState,
} from "@/lib/muthur/cognition/muthur-cognition-types";
import { getMuthurCommanderPosture } from "@/lib/muthur/mission/muthur-commander-posture";
import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import type { MuthurPosture } from "@/lib/muthur/muthur-posture";

export type UseMuthurCognitionBridgeParams = {
  muthurPosture: MuthurPosture;
  muthurMission: MuthurMission | null;
  setMuthurDiagnostics: Dispatch<SetStateAction<MuthurDiagnosticsState>>;
};

export function useMuthurCognitionBridge({
  muthurPosture,
  muthurMission,
  setMuthurDiagnostics,
}: UseMuthurCognitionBridgeParams) {
  const [, setMuthurCognition] = useState<MuthurCognitionState>(() => loadMuthurCognition());

  const emitMuthurCognition = useCallback(
    (input: MuthurCognitionEmitInput) => {
      setMuthurCognition((current) => recordMuthurCognitionEvent(current, input).state);
      if (shouldSurfaceCognitionForPosture(muthurPosture)) {
        setMuthurDiagnostics((current) =>
          appendMuthurDiagnosticEntry(current, formatMuthurCognitionDiagnosticFromInput(input)),
        );
      }
    },
    [muthurPosture],
  );

  const appendMuthurCognitionStatus = useCallback(
    (mode: MuthurPosture, mission: MuthurMission | null) => {
      const line = buildMuthurCognitionStatusLine(mode, {
        commanderPosture: getMuthurCommanderPosture(mode, mission),
        missionTitle: mission?.title,
      });
      if (line) {
        setMuthurDiagnostics((current) => appendMuthurDiagnosticEntry(current, line));
      }
    },
    [],
  );

  const muthurCognitionStatusLine = useMemo(
    () =>
      buildMuthurCognitionStatusLine(muthurPosture, {
        commanderPosture: getMuthurCommanderPosture(muthurPosture, muthurMission),
        missionTitle: muthurMission?.title,
      }),
    [muthurPosture, muthurMission],
  );

  return {
    emitMuthurCognition,
    appendMuthurCognitionStatus,
    muthurCognitionStatusLine,
  };
}
