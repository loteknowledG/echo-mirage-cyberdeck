"use client";

import { useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  getMuthurCommanderPosture,
  formatMuthurCommanderPostureLabel,
} from "@/lib/muthur/mission/muthur-commander-posture";
import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import { isOperationalMuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import type { MuthurUplinkMode } from "@/lib/muthur-uplink-mode";
import { getMuthurUplinkModeMeta } from "@/lib/muthur-uplink-mode";
import { cn } from "@/lib/utils";

type MuthurCommanderStatusProps = {
  mode: MuthurUplinkMode;
  mission: MuthurMission | null;
  disabled?: boolean;
  onCreateMission: (input: { title: string; objective: string }) => void;
  onStartMission?: () => void;
  className?: string;
};

export function MuthurCommanderStatus({
  mode,
  mission,
  disabled = false,
  onCreateMission,
  onStartMission,
  className,
}: MuthurCommanderStatusProps) {
  const [titleDraft, setTitleDraft] = useState("");
  const [objectiveDraft, setObjectiveDraft] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const modeLabel = getMuthurUplinkModeMeta(mode).label.toUpperCase();
  const posture = getMuthurCommanderPosture(mode, mission);
  const postureLabel = formatMuthurCommanderPostureLabel(posture);
  const showCommanderPanel = mode === "commander" || showCreateForm;

  if (!showCommanderPanel) {
    return null;
  }

  const handleCreate = () => {
    const title = titleDraft.trim();
    const objective = objectiveDraft.trim();
    if (!title || !objective) return;
    onCreateMission({ title, objective });
    setTitleDraft("");
    setObjectiveDraft("");
    setShowCreateForm(false);
  };

  const canStartMission =
    mission != null &&
    (mission.status === "draft" || mission.status === "ready") &&
    typeof onStartMission === "function";

  return (
    <div
      className={cn(
        "rounded border border-[#1c1c1c] bg-black/80 px-2 py-1.5 font-mono text-[9px] leading-relaxed tracking-[0.04em]",
        className,
      )}
    >
      <div className="space-y-0.5 text-[#8a8a8a]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span>
            Mode: <span className="text-emerald-300/90">{modeLabel}</span>
          </span>
          <span>
            Status:{" "}
            <span
              className={
                posture === "EXECUTING" || posture === "VERIFYING"
                  ? "text-emerald-300/80"
                  : posture === "WAITING"
                    ? "text-amber-200/85"
                    : "text-[#9a9a9a]"
              }
            >
              {postureLabel}
            </span>
          </span>
        </div>
        <p className="truncate text-[#707070]">
          MISSION:{" "}
          <span className="text-[#9a9a9a]">{mission?.title ?? "NONE"}</span>
        </p>
        {mission ? (
          <>
            <p className="line-clamp-2 text-[#666]">
              OBJECTIVE: <span className="text-[#8a8a8a]">{mission.objective}</span>
            </p>
            {mission.status === "blocked" && mission.blockedReason ? (
              <p className="text-amber-200/85">
                BLOCKED REASON:{" "}
                <span className="text-amber-100/90">{mission.blockedReason}</span>
              </p>
            ) : null}
            {mission.status === "aborted" && mission.abortReason ? (
              <p className="text-red-300/80">
                ABORT REASON: <span className="text-red-200/90">{mission.abortReason}</span>
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[#666]">
            Observe conversation, summarize intent, and prepare a mission before execution.
          </p>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1 border-t border-[#1c1c1c] pt-1.5">
        {!mission || mission.status === "completed" || mission.status === "aborted" ? (
          <CyberdeckActionButton
            variant="accent"
            disabled={disabled}
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? "Close" : "Create Mission"}
          </CyberdeckActionButton>
        ) : null}
        {canStartMission ? (
          <CyberdeckActionButton variant="accent" disabled={disabled} onClick={onStartMission}>
            Start Mission
          </CyberdeckActionButton>
        ) : null}
      </div>

      {showCreateForm && !isOperationalMuthurMission(mission) ? (
        <div className="mt-1.5 space-y-1.5 border-t border-[#1c1c1c] pt-1.5">
          <label className="block text-[#707070]">
            Title
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              disabled={disabled}
              className="mt-0.5 w-full rounded border border-[#2a2a2a] bg-black px-1.5 py-1 text-[9px] text-[#cfcfcf] outline-none focus:border-emerald-500/50"
              placeholder="Mission title"
            />
          </label>
          <label className="block text-[#707070]">
            Objective
            <textarea
              value={objectiveDraft}
              onChange={(event) => setObjectiveDraft(event.target.value)}
              disabled={disabled}
              rows={2}
              className="mt-0.5 w-full resize-none rounded border border-[#2a2a2a] bg-black px-1.5 py-1 text-[9px] text-[#cfcfcf] outline-none focus:border-emerald-500/50"
              placeholder="What should COMMANDER accomplish?"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <CyberdeckActionButton
              variant="accent"
              disabled={disabled || !titleDraft.trim() || !objectiveDraft.trim()}
              onClick={handleCreate}
            >
              Save Mission
            </CyberdeckActionButton>
            <CyberdeckActionButton
              disabled={disabled}
              onClick={() => {
                setShowCreateForm(false);
                setTitleDraft("");
                setObjectiveDraft("");
              }}
            >
              Cancel
            </CyberdeckActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
