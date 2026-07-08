"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import { useMuthurCognitionBridge } from "@/features/cyberdeck/muthur/use-muthur-cognition-bridge";
import { setMUTHURMode } from "@/lib/computer-use/control-lease";
import {
  formatDelegationCancelledLine,
  formatDelegationDispatchedLine,
  formatDelegationPreparedLine,
  formatDelegationResultLine,
} from "@/lib/muthur/delegation/muthur-delegation-events";
import {
  advanceMissionForDelegationDispatch,
  advanceMissionForDelegationResult,
  advanceMissionWhenDelegationsClear,
} from "@/lib/muthur/delegation/muthur-delegation-lifecycle";
import { formatMuthurDelegationPackageMessage } from "@/lib/muthur/delegation/muthur-delegation-package";
import {
  cancelMuthurDelegation,
  createMuthurDelegation,
  listDelegationsForMission,
  loadMuthurDelegations,
  markDelegationDispatched,
  recordDelegationResult,
  replaceDelegation,
  saveMuthurDelegations,
} from "@/lib/muthur/delegation/muthur-delegation-store";
import type {
  MuthurDelegationAssignment,
  MuthurDelegationWorkerId,
} from "@/lib/muthur/delegation/muthur-delegation-types";
import {
  createMuthurMission,
  loadMuthurMission,
  saveMuthurMission,
} from "@/lib/muthur/mission/muthur-mission-store";
import {
  activateMission,
  setMissionReady,
  type MissionLifecycleResult,
} from "@/lib/muthur/mission/muthur-mission-lifecycle";
import {
  formatMuthurCommanderActivatedLine,
  formatMuthurCommanderArchiveLine,
  formatMuthurMissionCreatedLine,
  formatMuthurPostureChangedLine,
} from "@/lib/muthur/mission/muthur-commander-events";
import { getMuthurCommanderPosture } from "@/lib/muthur/mission/muthur-commander-posture";
import { isOperationalMuthurMission, type MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import {
  cognitionFromCommanderPosture,
  cognitionFromDelegationCancelled,
  cognitionFromDelegationDispatched,
  cognitionFromDelegationPrepared,
  cognitionFromDelegationResult,
  cognitionFromMissionCreated,
  cognitionFromMissionLifecycle,
} from "@/lib/muthur/cognition/muthur-cognition-events";
import {
  formatMuthurInhabitantChangedLine,
  loadMuthurInhabitant,
  normalizeMuthurInhabitant,
  saveMuthurInhabitant,
  type MuthurInhabitant,
} from "@/lib/muthur/muthur-inhabitant";
import {
  getMuthurPostureMeta,
  loadMuthurPosture,
  normalizeMuthurPosture,
  saveMuthurPosture,
  type MuthurPosture,
} from "@/lib/muthur/muthur-posture";
import type { MuthurDiagnosticsState } from "@/lib/muthur-core/muthur-diagnostics-channel";

export type UseMuthurCommanderHandlersParams = {
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
  setMuthurDiagnostics: Dispatch<SetStateAction<MuthurDiagnosticsState>>;
  piControlLeaseRefresh: () => Promise<void>;
  piControlLeaseRetake: () => Promise<void>;
};

export function useMuthurCommanderHandlers({
  setMessages,
  setMuthurDiagnostics,
  piControlLeaseRefresh,
  piControlLeaseRetake,
}: UseMuthurCommanderHandlersParams) {
  const [muthurPosture, setMuthurPosture] = useState<MuthurPosture>(() => loadMuthurPosture());
  const [muthurInhabitant, setMuthurInhabitant] = useState<MuthurInhabitant>(() =>
    loadMuthurInhabitant(),
  );
  const [muthurMission, setMuthurMission] = useState<MuthurMission | null>(() => loadMuthurMission());
  const [muthurDelegations, setMuthurDelegations] = useState<MuthurDelegationAssignment[]>(() =>
    loadMuthurDelegations(),
  );

  const { emitMuthurCognition, appendMuthurCognitionStatus, muthurCognitionStatusLine } =
    useMuthurCognitionBridge({
      muthurPosture,
      muthurMission,
      setMuthurDiagnostics,
    });

  const archiveMuthurHistoryLine = useCallback(
    (line: string) => {
      setMessages((prev) => [...prev, { role: "system", text: line }]);
    },
    [setMessages],
  );

  const handleMuthurPostureChange = useCallback(
    (next: MuthurPosture) => {
      const resolved = normalizeMuthurPosture(next);
      if (resolved === muthurPosture) return;

      if (resolved === "commander") {
        const posture = getMuthurCommanderPosture("commander", muthurMission) ?? "AWAITING_MISSION";
        if (posture === "AWAITING_MISSION" && !muthurMission) {
          archiveMuthurHistoryLine(
            formatMuthurCommanderArchiveLine("muthur_commander_awaiting_mission"),
          );
        }
        emitMuthurCognition(
          cognitionFromCommanderPosture({
            posture,
            missionTitle: muthurMission?.title,
          }),
        );
        archiveMuthurHistoryLine(
          formatMuthurCommanderActivatedLine({
            posture,
            title: muthurMission?.title,
          }),
        );
      } else if (muthurPosture === "commander") {
        archiveMuthurHistoryLine(
          formatMuthurCommanderArchiveLine("muthur_commander_stood_down", { to: resolved }),
        );
      }

      archiveMuthurHistoryLine(formatMuthurPostureChangedLine(muthurPosture, resolved));
      appendMuthurCognitionStatus(resolved, muthurMission);
      setMuthurPosture(resolved);
    },
    [appendMuthurCognitionStatus, archiveMuthurHistoryLine, emitMuthurCognition, muthurMission, muthurPosture],
  );

  const handleMuthurInhabitantChange = useCallback(
    (next: MuthurInhabitant) => {
      const resolved = normalizeMuthurInhabitant(next);
      if (resolved === muthurInhabitant) return;
      setMessages((prev) => [
        ...prev,
        { role: "system", text: formatMuthurInhabitantChangedLine(muthurInhabitant, resolved) },
      ]);
      setMuthurInhabitant(resolved);
    },
    [muthurInhabitant],
  );

  const handleCreateMuthurMission = useCallback(
    (input: { title: string; objective: string }) => {
      const draft = createMuthurMission(input);
      const ready = setMissionReady(draft);

      setMuthurMission(ready.mission);
      archiveMuthurHistoryLine(formatMuthurMissionCreatedLine(draft));
      if (ready.ok) {
        archiveMuthurHistoryLine(ready.archiveLine);
      }
      emitMuthurCognition(cognitionFromMissionCreated(ready.mission));
    },
    [archiveMuthurHistoryLine, emitMuthurCognition],
  );

  const handleStartMuthurMission = useCallback(() => {
    if (!muthurMission) return;
    const activated = activateMission(
      muthurMission.status === "draft" ? setMissionReady(muthurMission).mission : muthurMission,
    );
    if (!activated.ok) {
      archiveMuthurHistoryLine(activated.archiveLine);
      emitMuthurCognition(cognitionFromMissionLifecycle(activated, muthurMission));
      return;
    }
    setMuthurMission(activated.mission);
    archiveMuthurHistoryLine(activated.archiveLine);
    emitMuthurCognition(cognitionFromMissionLifecycle(activated, activated.mission));
  }, [archiveMuthurHistoryLine, emitMuthurCognition, muthurMission]);

  const applyMissionLifecycleResult = useCallback(
    (result: MissionLifecycleResult | null) => {
      if (!result) return;
      setMuthurMission(result.mission);
      archiveMuthurHistoryLine(result.archiveLine);
      emitMuthurCognition(cognitionFromMissionLifecycle(result, result.mission));
    },
    [archiveMuthurHistoryLine, emitMuthurCognition],
  );

  const handleCreateMuthurDelegation = useCallback(
    (input: {
      workerId: MuthurDelegationWorkerId;
      title: string;
      objective: string;
      context: string;
      acceptanceCriteria: string[];
    }) => {
      if (!isOperationalMuthurMission(muthurMission)) return;
      const assignment = createMuthurDelegation({
        mission: muthurMission,
        workerId: input.workerId,
        title: input.title,
        objective: input.objective,
        context: input.context,
        acceptanceCriteria: input.acceptanceCriteria,
      });
      setMuthurDelegations((current) => [assignment, ...current]);
      archiveMuthurHistoryLine(formatDelegationPreparedLine(assignment));
      emitMuthurCognition(cognitionFromDelegationPrepared(assignment));
    },
    [archiveMuthurHistoryLine, emitMuthurCognition, muthurMission],
  );

  const handleDispatchMuthurDelegation = useCallback(
    async (assignmentId: string): Promise<string | null> => {
      if (!isOperationalMuthurMission(muthurMission)) return null;
      const current = muthurDelegations.find((entry) => entry.id === assignmentId);
      if (!current || current.status !== "draft") return null;

      const dispatched = markDelegationDispatched(current);
      const nextDelegations = replaceDelegation(muthurDelegations, dispatched);
      setMuthurDelegations(nextDelegations);
      archiveMuthurHistoryLine(formatDelegationDispatchedLine(dispatched));

      const missionAssignments = listDelegationsForMission(nextDelegations, muthurMission.id);
      const lifecycle = advanceMissionForDelegationDispatch(muthurMission, missionAssignments);
      applyMissionLifecycleResult(lifecycle);
      emitMuthurCognition(cognitionFromDelegationDispatched(dispatched));

      const missionForPackage = lifecycle?.mission ?? muthurMission;
      return formatMuthurDelegationPackageMessage({
        mission: missionForPackage,
        assignment: dispatched,
      });
    },
    [applyMissionLifecycleResult, muthurDelegations, muthurMission, archiveMuthurHistoryLine],
  );

  const handleRecordMuthurDelegationResult = useCallback(
    (assignmentId: string, input: { success: boolean; summary: string }) => {
      if (!muthurMission) return;
      const current = muthurDelegations.find((entry) => entry.id === assignmentId);
      if (!current) return;

      const recorded = recordDelegationResult(current, input);
      const nextDelegations = replaceDelegation(muthurDelegations, recorded);
      setMuthurDelegations(nextDelegations);
      archiveMuthurHistoryLine(formatDelegationResultLine(recorded, input.success));

      const missionAssignments = listDelegationsForMission(nextDelegations, muthurMission.id);
      applyMissionLifecycleResult(
        advanceMissionForDelegationResult(muthurMission, missionAssignments, input.success),
      );
      emitMuthurCognition(cognitionFromDelegationResult(recorded, input.success));
    },
    [applyMissionLifecycleResult, emitMuthurCognition, muthurDelegations, muthurMission, archiveMuthurHistoryLine],
  );

  const handleCancelMuthurDelegation = useCallback(
    (assignmentId: string) => {
      if (!muthurMission) return;
      const current = muthurDelegations.find((entry) => entry.id === assignmentId);
      if (!current) return;

      const cancelled = cancelMuthurDelegation(current);
      const nextDelegations = replaceDelegation(muthurDelegations, cancelled);
      setMuthurDelegations(nextDelegations);
      archiveMuthurHistoryLine(formatDelegationCancelledLine(cancelled));

      const missionAssignments = listDelegationsForMission(nextDelegations, muthurMission.id);
      applyMissionLifecycleResult(
        advanceMissionWhenDelegationsClear(muthurMission, missionAssignments),
      );
      emitMuthurCognition(cognitionFromDelegationCancelled(cancelled));
    },
    [applyMissionLifecycleResult, emitMuthurCognition, muthurDelegations, muthurMission, archiveMuthurHistoryLine],
  );

  useEffect(() => {
    saveMuthurMission(muthurMission);
  }, [muthurMission]);

  useEffect(() => {
    saveMuthurDelegations(muthurDelegations);
  }, [muthurDelegations]);

  useEffect(() => {
    saveMuthurPosture(muthurPosture);
    setMUTHURMode(getMuthurPostureMeta(muthurPosture).internalMode);
    if (muthurPosture !== "agent") return;
    void (async () => {
      try {
        await piControlLeaseRefresh();
        await piControlLeaseRetake();
      } catch {
        /* ignore */
      }
    })();
  }, [muthurPosture, piControlLeaseRefresh, piControlLeaseRetake]);

  useEffect(() => {
    saveMuthurInhabitant(muthurInhabitant);
  }, [muthurInhabitant]);

  return {
    muthurPosture,
    muthurMission,
    muthurDelegations,
    muthurInhabitant,
    handleMuthurPostureChange,
    handleMuthurInhabitantChange,
    handleCreateMuthurMission,
    handleStartMuthurMission,
    handleCreateMuthurDelegation,
    handleDispatchMuthurDelegation,
    handleRecordMuthurDelegationResult,
    handleCancelMuthurDelegation,
    archiveMuthurHistoryLine,
    emitMuthurCognition,
    appendMuthurCognitionStatus,
    muthurCognitionStatusLine,
  };
}
