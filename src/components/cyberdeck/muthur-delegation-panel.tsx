"use client";

import { useMemo, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { formatMuthurDelegationPackageMessage } from "@/lib/muthur/delegation/muthur-delegation-package";
import {
  formatDelegationStatusLabel,
  listDelegationsForMission,
  parseAcceptanceCriteriaInput,
} from "@/lib/muthur/delegation/muthur-delegation-store";
import type {
  MuthurDelegationAssignment,
  MuthurDelegationWorkerId,
} from "@/lib/muthur/delegation/muthur-delegation-types";
import { MUTHUR_DELEGATION_WORKERS } from "@/lib/muthur/delegation/muthur-workers";
import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import { isOperationalMuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import { cn } from "@/lib/utils";

type MuthurDelegationPanelProps = {
  mission: MuthurMission | null;
  assignments: MuthurDelegationAssignment[];
  disabled?: boolean;
  onCreateDelegation: (input: {
    workerId: MuthurDelegationWorkerId;
    title: string;
    objective: string;
    context: string;
    acceptanceCriteria: string[];
  }) => void;
  onDispatchDelegation: (assignmentId: string) => Promise<string | null>;
  onRecordDelegationResult: (assignmentId: string, input: { success: boolean; summary: string }) => void;
  onCancelDelegation: (assignmentId: string) => void;
  className?: string;
};

async function copyDelegationText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof window !== "undefined" && window.echoMirageClipboard?.writeText) {
      window.echoMirageClipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function MuthurDelegationPanel({
  mission,
  assignments,
  disabled = false,
  onCreateDelegation,
  onDispatchDelegation,
  onRecordDelegationResult,
  onCancelDelegation,
  className,
}: MuthurDelegationPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [workerId, setWorkerId] = useState<MuthurDelegationWorkerId>("cursor");
  const [titleDraft, setTitleDraft] = useState("");
  const [objectiveDraft, setObjectiveDraft] = useState("");
  const [contextDraft, setContextDraft] = useState("");
  const [criteriaDraft, setCriteriaDraft] = useState("");
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [resultDraftById, setResultDraftById] = useState<Record<string, string>>({});
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const missionAssignments = useMemo(() => {
    if (!mission) return [];
    return listDelegationsForMission(assignments, mission.id);
  }, [assignments, mission]);

  if (!isOperationalMuthurMission(mission)) {
    return null;
  }

  const resetCreateForm = () => {
    setTitleDraft("");
    setObjectiveDraft("");
    setContextDraft(mission.objective);
    setCriteriaDraft("");
    setWorkerId("cursor");
    setShowCreateForm(false);
  };

  const handleCreate = () => {
    const title = titleDraft.trim();
    const objective = objectiveDraft.trim();
    if (!title || !objective) return;
    onCreateDelegation({
      workerId,
      title,
      objective,
      context: contextDraft.trim() || mission.objective,
      acceptanceCriteria: parseAcceptanceCriteriaInput(criteriaDraft),
    });
    resetCreateForm();
  };

  const handleDispatch = async (assignment: MuthurDelegationAssignment) => {
    const message = await onDispatchDelegation(assignment.id);
    if (!message) return;
    const copied = await copyDelegationText(message);
    setCopyNotice(
      copied
        ? `Package copied for ${assignment.package.workerLabel}.`
        : `Package ready for ${assignment.package.workerLabel} (copy failed).`,
    );
    setExpandedAssignmentId(assignment.id);
  };

  return (
    <div
      className={cn(
        "rounded border border-[#1c1c1c] bg-black/80 px-2 py-1.5 font-mono text-[9px] leading-relaxed tracking-[0.04em]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[#8a8a8a]">
          Delegations <span className="text-[#666]">({missionAssignments.length})</span>
        </span>
        <CyberdeckActionButton
          variant="accent"
          disabled={disabled}
          onClick={() => {
            setShowCreateForm((current) => !current);
            setContextDraft(mission.objective);
          }}
        >
          {showCreateForm ? "Close" : "Delegate Work"}
        </CyberdeckActionButton>
      </div>

      {copyNotice ? <p className="mt-1 text-emerald-300/80">{copyNotice}</p> : null}

      {showCreateForm ? (
        <div className="mt-1.5 space-y-1.5 border-t border-[#1c1c1c] pt-1.5">
          <label className="block text-[#707070]">
            Worker
            <select
              value={workerId}
              onChange={(event) => setWorkerId(event.target.value as MuthurDelegationWorkerId)}
              disabled={disabled}
              className="mt-0.5 w-full rounded border border-[#2a2a2a] bg-black px-1.5 py-1 text-[9px] text-[#cfcfcf] outline-none focus:border-emerald-500/50"
            >
              {MUTHUR_DELEGATION_WORKERS.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.label} — {worker.role}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[#707070]">
            Task title
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              disabled={disabled}
              className="mt-0.5 w-full rounded border border-[#2a2a2a] bg-black px-1.5 py-1 text-[9px] text-[#cfcfcf] outline-none focus:border-emerald-500/50"
              placeholder="What should the worker do?"
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
              placeholder="Clear, bounded assignment for the worker"
            />
          </label>
          <label className="block text-[#707070]">
            Context
            <textarea
              value={contextDraft}
              onChange={(event) => setContextDraft(event.target.value)}
              disabled={disabled}
              rows={2}
              className="mt-0.5 w-full resize-none rounded border border-[#2a2a2a] bg-black px-1.5 py-1 text-[9px] text-[#cfcfcf] outline-none focus:border-emerald-500/50"
              placeholder="Mission context, paths, constraints"
            />
          </label>
          <label className="block text-[#707070]">
            Acceptance criteria (one per line)
            <textarea
              value={criteriaDraft}
              onChange={(event) => setCriteriaDraft(event.target.value)}
              disabled={disabled}
              rows={2}
              className="mt-0.5 w-full resize-none rounded border border-[#2a2a2a] bg-black px-1.5 py-1 text-[9px] text-[#cfcfcf] outline-none focus:border-emerald-500/50"
              placeholder="tsc passes&#10;probe green"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <CyberdeckActionButton
              variant="accent"
              disabled={disabled || !titleDraft.trim() || !objectiveDraft.trim()}
              onClick={handleCreate}
            >
              Prepare Package
            </CyberdeckActionButton>
            <CyberdeckActionButton disabled={disabled} onClick={resetCreateForm}>
              Cancel
            </CyberdeckActionButton>
          </div>
        </div>
      ) : null}

      {missionAssignments.length > 0 ? (
        <ul className="mt-1.5 space-y-1 border-t border-[#1c1c1c] pt-1.5">
          {missionAssignments.map((assignment) => {
            const expanded = expandedAssignmentId === assignment.id;
            const resultDraft = resultDraftById[assignment.id] ?? "";
            const packagePreview =
              mission && expanded
                ? formatMuthurDelegationPackageMessage({ mission, assignment })
                : "";

            return (
              <li key={assignment.id} className="rounded border border-[#1a1a1a] bg-black/60 p-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[#9a9a9a]">{assignment.package.workerLabel}</span>
                  <span className="truncate text-[#707070]">{assignment.package.title}</span>
                  <span className="text-emerald-300/70">
                    {formatDelegationStatusLabel(assignment.status)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {assignment.status === "draft" ? (
                    <CyberdeckActionButton
                      variant="accent"
                      disabled={disabled}
                      onClick={() => void handleDispatch(assignment)}
                    >
                      Dispatch + Copy
                    </CyberdeckActionButton>
                  ) : null}
                  {assignment.status === "awaiting_result" ? (
                    <>
                      <CyberdeckActionButton
                        disabled={disabled}
                        onClick={() =>
                          setExpandedAssignmentId(expanded ? null : assignment.id)
                        }
                      >
                        {expanded ? "Hide Package" : "View Package"}
                      </CyberdeckActionButton>
                      <CyberdeckActionButton
                        variant="accent"
                        disabled={disabled || !resultDraft.trim()}
                        onClick={() => {
                          onRecordDelegationResult(assignment.id, {
                            success: true,
                            summary: resultDraft,
                          });
                          setResultDraftById((current) => {
                            const next = { ...current };
                            delete next[assignment.id];
                            return next;
                          });
                        }}
                      >
                        Record Success
                      </CyberdeckActionButton>
                      <CyberdeckActionButton
                        disabled={disabled || !resultDraft.trim()}
                        onClick={() => {
                          onRecordDelegationResult(assignment.id, {
                            success: false,
                            summary: resultDraft,
                          });
                          setResultDraftById((current) => {
                            const next = { ...current };
                            delete next[assignment.id];
                            return next;
                          });
                        }}
                      >
                        Record Failure
                      </CyberdeckActionButton>
                    </>
                  ) : null}
                  {assignment.status === "draft" || assignment.status === "awaiting_result" ? (
                    <CyberdeckActionButton
                      disabled={disabled}
                      onClick={() => onCancelDelegation(assignment.id)}
                    >
                      Cancel
                    </CyberdeckActionButton>
                  ) : null}
                </div>
                {assignment.status === "awaiting_result" ? (
                  <textarea
                    value={resultDraft}
                    onChange={(event) =>
                      setResultDraftById((current) => ({
                        ...current,
                        [assignment.id]: event.target.value,
                      }))
                    }
                    disabled={disabled}
                    rows={2}
                    className="mt-1 w-full resize-none rounded border border-[#2a2a2a] bg-black px-1.5 py-1 text-[9px] text-[#cfcfcf] outline-none focus:border-emerald-500/50"
                    placeholder="Paste worker result summary"
                  />
                ) : null}
                {assignment.resultSummary ? (
                  <p className="mt-1 whitespace-pre-wrap text-[#777]">{assignment.resultSummary}</p>
                ) : null}
                {expanded && packagePreview ? (
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-[#222] bg-[#050505] p-1.5 text-[8px] text-[#8a8a8a]">
                    {packagePreview}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-[#666]">No delegations for this mission.</p>
      )}
    </div>
  );
}
