"use client";

import { useEffect, useRef } from "react";
import { createRetakeSequenceTracker } from "@/lib/muthur/control/konami-retake-sequence";
import type { PiControlLeaseSnapshot } from "@/lib/muthur/control/pi-control-lease-types";

type MuthurControlLeaseHostProps = {
  snapshot: PiControlLeaseSnapshot;
  onGrant: () => void | Promise<void>;
  onDeny: () => void | Promise<void>;
  onRetake: () => void | Promise<void>;
  onContinueMission: () => void | Promise<void>;
  onReportConflict: () => void | Promise<void>;
};

export function MuthurControlLeaseHost({
  snapshot,
  onGrant,
  onDeny,
  onRetake,
  onContinueMission,
  onReportConflict,
}: MuthurControlLeaseHostProps) {
  const retakeTrackerRef = useRef(createRetakeSequenceTracker());
  const conflictReportedRef = useRef(false);
  const leaseActive = snapshot.activeLease?.leaseStatus === "active";
  const pending = snapshot.pendingRequest;

  useEffect(() => {
    if (!leaseActive) {
      conflictReportedRef.current = false;
      retakeTrackerRef.current.reset();
      return;
    }

    let moveTimer: number | null = null;
    const onPointer = () => {
      if (conflictReportedRef.current) return;
      if (moveTimer != null) return;
      moveTimer = window.setTimeout(() => {
        moveTimer = null;
        conflictReportedRef.current = true;
        void onReportConflict();
      }, 120);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (snapshot.conflictDetected) {
        if (retakeTrackerRef.current.push(event.key)) {
          void onRetake();
        }
        return;
      }
      if (conflictReportedRef.current) return;
      conflictReportedRef.current = true;
      void onReportConflict();
    };

    window.addEventListener("mousemove", onPointer, { passive: true });
    window.addEventListener("mousedown", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      if (moveTimer != null) window.clearTimeout(moveTimer);
      window.removeEventListener("mousemove", onPointer);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [leaseActive, onReportConflict, onRetake, snapshot.conflictDetected]);

  useEffect(() => {
    if (!snapshot.conflictDetected) {
      retakeTrackerRef.current.reset();
    }
  }, [snapshot.conflictDetected]);

  return (
    <>
      {pending ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-labelledby="pi-control-request-title"
            className="w-full max-w-md rounded border border-amber-500/40 bg-[#0a0a0a] p-4 font-mono text-[11px] text-gray-200 shadow-[0_0_24px_rgba(251,191,36,0.12)]"
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90">
              Control Request
            </p>
            <h2 id="pi-control-request-title" className="mt-2 text-sm text-amber-100">
              {pending.task}
            </h2>
            <dl className="mt-3 space-y-1 text-[10px] text-gray-400">
              <div>
                <dt className="inline text-amber-500/80">Operator: </dt>
                <dd className="inline text-emerald-300">Pi</dd>
              </div>
              <div>
                <dt className="inline text-amber-500/80">Capabilities: </dt>
                <dd className="inline">{pending.capabilities.join(", ")}</dd>
              </div>
              <div>
                <dt className="inline text-amber-500/80">Reason: </dt>
                <dd className="inline">{pending.reason}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onGrant()}
                className="rounded border border-emerald-500/50 bg-emerald-950/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-900/50"
              >
                Grant Control
              </button>
              <button
                type="button"
                onClick={() => void onDeny()}
                className="rounded border border-[#333] bg-black px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-gray-400 hover:border-red-500/40 hover:text-red-300"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {leaseActive && snapshot.activeLease ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded border border-emerald-500/35 bg-black/90 px-3 py-2 font-mono text-[10px] text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.15)]">
          <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-400/90">
            Echo Mirage Has Control
          </p>
          <p className="mt-1">
            Operator: <span className="text-emerald-300">Pi</span>
          </p>
          <p>
            Task: <span className="text-gray-200">{snapshot.activeLease.task}</span>
          </p>
          <p>
            Lease: <span className="text-emerald-300">Active</span>
          </p>
        </div>
      ) : null}

      {snapshot.conflictDetected && snapshot.activeLease ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4">
          <div
            role="alertdialog"
            aria-labelledby="pi-control-conflict-title"
            className="w-full max-w-md rounded border border-red-500/40 bg-[#0a0a0a] p-4 font-mono text-[11px] text-gray-200"
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-red-400/90">
              Control Conflict Detected
            </p>
            <h2 id="pi-control-conflict-title" className="mt-2 text-sm text-red-100">
              Pi currently holds control
            </h2>
            <p className="mt-2 text-gray-400">
              Task: <span className="text-gray-200">{snapshot.activeLease.task}</span>
            </p>
            <p className="mt-3 text-[10px] text-amber-300/90">
              To retake control: {retakeTrackerRef.current.label()}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onContinueMission()}
                className="rounded border border-[#333] bg-black px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-gray-300 hover:border-amber-500/40"
              >
                Continue Mission
              </button>
              <button
                type="button"
                onClick={() => void onRetake()}
                className="rounded border border-red-500/50 bg-red-950/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-red-200 hover:bg-red-900/40"
              >
                Retake Control
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
