"use client";

import { useMemo, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import {
  CASE_ACTION_DEFINITIONS,
  caseActionDisabledReason,
  type CaseActionId,
} from "@/lib/property-manager/actions";
import { performCaseAction } from "@/lib/property-manager/cases";
import type { CaseDetailPayload } from "@/lib/property-manager/cases";
import type { PropertyCase } from "@/lib/property-manager/cases/types";
import { cn } from "@/lib/utils";

type CaseActionsProps = {
  caseRecord: PropertyCase;
  onUpdated: (detail: CaseDetailPayload) => void;
};

type InputActionId = "assign_technician" | "add_eta" | "send_resident_update" | "add_operator_note";

const INPUT_ACTIONS = new Set<CaseActionId>([
  "assign_technician",
  "add_eta",
  "send_resident_update",
  "add_operator_note",
]);

export function CaseActions({ caseRecord, onUpdated }: CaseActionsProps) {
  const [busy, setBusy] = useState<CaseActionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<InputActionId | null>(null);
  const [technicianName, setTechnicianName] = useState("");
  const [vendor, setVendor] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [eta, setEta] = useState("");
  const [etaNotes, setEtaNotes] = useState("");
  const [residentMessage, setResidentMessage] = useState("");
  const [operatorNote, setOperatorNote] = useState("");

  const disabledReasons = useMemo(() => {
    const map = new Map<CaseActionId, string | null>();
    for (const def of CASE_ACTION_DEFINITIONS) {
      map.set(def.id, caseActionDisabledReason(caseRecord, def.id));
    }
    return map;
  }, [caseRecord]);

  const runAction = async (action: CaseActionId, input?: Record<string, string>) => {
    setBusy(action);
    setError(null);
    try {
      const detail = await performCaseAction(caseRecord.slug, action, input);
      onUpdated(detail);
      setActiveInput(null);
      setTechnicianName("");
      setVendor("");
      setAssignNotes("");
      setEta("");
      setEtaNotes("");
      setResidentMessage("");
      setOperatorNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const handleActionClick = (action: CaseActionId) => {
    if (INPUT_ACTIONS.has(action)) {
      setActiveInput(action as InputActionId);
      setError(null);
      return;
    }
    void runAction(action);
  };

  return (
    <section className="rounded-sm border border-[#25352c] bg-black/80 p-3">
      <h3 className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#606060]">CASE ACTIONS</h3>
      <div className="flex flex-wrap gap-1.5">
        {CASE_ACTION_DEFINITIONS.map((def) => {
          const reason = disabledReasons.get(def.id);
          const disabled = Boolean(reason) || busy !== null;
          return (
            <button
              key={def.id}
              type="button"
              disabled={disabled}
              title={reason ?? undefined}
              onClick={() => handleActionClick(def.id)}
              className={cn(
                "rounded-sm border px-2 py-1.5 font-mono text-[8px] tracking-[0.06em] transition-colors",
                disabled
                  ? "cursor-not-allowed border-[#1f1f1f] text-[#555]"
                  : "border-[#2d4035] text-[#c5d5cc] hover:border-emerald-500/35 hover:text-emerald-300",
                busy === def.id && "opacity-60",
              )}
            >
              {def.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-2 font-mono text-[9px] tracking-[0.04em] text-rose-300">{error}</p>
      ) : null}

      {activeInput === "assign_technician" ? (
        <div className="mt-3 space-y-2 rounded-sm border border-[#1c1c1c] bg-black/60 p-2">
          <label className="block font-mono text-[8px] tracking-[0.08em] text-[#707070]">
            TECHNICIAN NAME
            <input
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              className="mt-1 w-full border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
            />
          </label>
          <label className="block font-mono text-[8px] tracking-[0.08em] text-[#707070]">
            VENDOR (OPTIONAL)
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="mt-1 w-full border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
            />
          </label>
          <label className="block font-mono text-[8px] tracking-[0.08em] text-[#707070]">
            NOTES (OPTIONAL)
            <textarea
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
            />
          </label>
          <div className="flex gap-2">
            <CyberdeckActionButton
              disabled={busy !== null || !technicianName.trim()}
              onClick={() =>
                void runAction("assign_technician", {
                  technicianName: technicianName.trim(),
                  ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
                  ...(assignNotes.trim() ? { notes: assignNotes.trim() } : {}),
                })
              }
            >
              Confirm Assign
            </CyberdeckActionButton>
            <CyberdeckActionButton variant="neutral" onClick={() => setActiveInput(null)}>
              Cancel
            </CyberdeckActionButton>
          </div>
        </div>
      ) : null}

      {activeInput === "add_eta" ? (
        <div className="mt-3 space-y-2 rounded-sm border border-[#1c1c1c] bg-black/60 p-2">
          <label className="block font-mono text-[8px] tracking-[0.08em] text-[#707070]">
            ETA (OPERATOR PROVIDED)
            <input
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="e.g. 45 minutes"
              className="mt-1 w-full border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
            />
          </label>
          <label className="block font-mono text-[8px] tracking-[0.08em] text-[#707070]">
            NOTES (OPTIONAL)
            <textarea
              value={etaNotes}
              onChange={(e) => setEtaNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
            />
          </label>
          <div className="flex gap-2">
            <CyberdeckActionButton
              disabled={busy !== null || !eta.trim()}
              onClick={() =>
                void runAction("add_eta", {
                  eta: eta.trim(),
                  ...(etaNotes.trim() ? { notes: etaNotes.trim() } : {}),
                })
              }
            >
              Confirm ETA
            </CyberdeckActionButton>
            <CyberdeckActionButton variant="neutral" onClick={() => setActiveInput(null)}>
              Cancel
            </CyberdeckActionButton>
          </div>
        </div>
      ) : null}

      {activeInput === "send_resident_update" ? (
        <div className="mt-3 space-y-2 rounded-sm border border-[#1c1c1c] bg-black/60 p-2">
          <label className="block font-mono text-[8px] tracking-[0.08em] text-[#707070]">
            RESIDENT MESSAGE (RECORD ONLY)
            <textarea
              value={residentMessage}
              onChange={(e) => setResidentMessage(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
            />
          </label>
          <div className="flex gap-2">
            <CyberdeckActionButton
              disabled={busy !== null || !residentMessage.trim()}
              onClick={() =>
                void runAction("send_resident_update", { message: residentMessage.trim() })
              }
            >
              Record Update
            </CyberdeckActionButton>
            <CyberdeckActionButton variant="neutral" onClick={() => setActiveInput(null)}>
              Cancel
            </CyberdeckActionButton>
          </div>
        </div>
      ) : null}

      {activeInput === "add_operator_note" ? (
        <div className="mt-3 space-y-2 rounded-sm border border-[#1c1c1c] bg-black/60 p-2">
          <label className="block font-mono text-[8px] tracking-[0.08em] text-[#707070]">
            OPERATOR NOTE
            <textarea
              value={operatorNote}
              onChange={(e) => setOperatorNote(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
            />
          </label>
          <div className="flex gap-2">
            <CyberdeckActionButton
              disabled={busy !== null || !operatorNote.trim()}
              onClick={() => void runAction("add_operator_note", { note: operatorNote.trim() })}
            >
              Add Note
            </CyberdeckActionButton>
            <CyberdeckActionButton variant="neutral" onClick={() => setActiveInput(null)}>
              Cancel
            </CyberdeckActionButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
