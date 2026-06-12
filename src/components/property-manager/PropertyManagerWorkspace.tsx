"use client";

import Link from "next/link";
import { useState } from "react";
import { CaseViewerBoard } from "@/components/property-manager/CaseViewerBoard";
import { FloatingPhoneDialer } from "@/components/property-manager/FloatingPhoneDialer";
import type { SelectedCaseDialerContext } from "@/lib/property-manager/call-sessions";

export function PropertyManagerWorkspace() {
  const [boundaryElement, setBoundaryElement] = useState<HTMLDivElement | null>(null);
  const [selectedCase, setSelectedCase] = useState<SelectedCaseDialerContext | null>(null);
  const [caseRefreshSignal, setCaseRefreshSignal] = useState(0);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3">
      <div
        ref={setBoundaryElement}
        data-phone-dialer-boundary
        className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-visible"
      >
        <header className="shrink-0 rounded-sm border border-[#18231d] bg-[#030706] p-3">
          <nav data-testid="property-nav" className="mb-3 flex flex-wrap gap-2 font-mono text-[10px] tracking-[0.08em]">
            <Link className="border border-emerald-900 px-2 py-1 text-emerald-300" href="/property-manager">
              PROPERTY MODE
            </Link>
            <Link className="border border-[#252525] px-2 py-1 text-[#8a8a8a]" href="/cyberdeck">
              CYBERDECK
            </Link>
            <Link className="border border-[#252525] px-2 py-1 text-[#8a8a8a]" href="/send">
              SEND
            </Link>
          </nav>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-mono text-base tracking-[0.12em] text-emerald-200 sm:text-lg">
                PROPERTY MANAGER // OPERATIONS
              </h1>
              <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-[#7a8b82]">
                CASE BOARD // FLOATING PHONE
              </p>
            </div>
            <Link
              href="/property-manager/call-sim"
              className="w-fit rounded-sm border border-[#2d4035] px-3 py-2 font-mono text-[10px] tracking-[0.08em] text-[#9fb2a8]"
            >
              OPEN CALL SIM
            </Link>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CaseViewerBoard
            onSelectedCaseChange={setSelectedCase}
            refreshSignal={caseRefreshSignal}
          />
        </div>
        <FloatingPhoneDialer
          boundaryElement={boundaryElement}
          selectedCase={selectedCase}
          onCallEnded={() => setCaseRefreshSignal((value) => value + 1)}
        />
      </div>
    </div>
  );
}
