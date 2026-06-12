"use client";

import { useEffect, useState } from "react";
import { FcEndCall } from "react-icons/fc";
import { MdHome, MdPlumbing } from "react-icons/md";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import {
  formatCallDuration,
  formatPhoneCallerId,
  type CallSession,
  type SelectedCaseDialerContext,
} from "@/lib/property-manager/call-sessions";
import { formatCaseLabel } from "@/lib/property-manager/cases";
import { cn } from "@/lib/utils";

type CallerIdActiveCallProps = {
  session: CallSession;
  selectedCase: SelectedCaseDialerContext | null;
  controlsLocked: boolean;
  compact?: boolean;
  onHangUp: () => void;
  onAttachToCase?: () => void;
};

function callerDisplayName(session: CallSession): string {
  if (session.participantName?.trim()) return session.participantName.trim();
  return formatCaseLabel(session.participantType);
}

function caseSubtitle(session: CallSession, selectedCase: SelectedCaseDialerContext | null): string | null {
  if (session.casePropertyName && session.caseUnitId) {
    return `${session.casePropertyName} — Unit ${session.caseUnitId.toUpperCase()}`;
  }
  if (
    selectedCase &&
    session.caseSlug === selectedCase.slug &&
    selectedCase.propertyName &&
    selectedCase.unitId
  ) {
    return `${selectedCase.propertyName} — Unit ${selectedCase.unitId.toUpperCase()}`;
  }
  return null;
}

function CallerIdIcon({ session, compact }: { session: CallSession; compact?: boolean }) {
  const Icon = session.participantType === "vendor" ? MdPlumbing : MdHome;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border-2 border-emerald-500/60 bg-emerald-950/30 shadow-[0_0_12px_rgba(57,255,136,0.1)]",
        compact ? "h-12 w-12" : "h-20 w-20",
      )}
    >
      <Icon className={cn("text-emerald-400", compact ? "h-5 w-5" : "h-9 w-9")} aria-hidden />
    </div>
  );
}

export function CallerIdActiveCall({
  session,
  selectedCase,
  controlsLocked,
  compact = false,
  onHangUp,
  onAttachToCase,
}: CallerIdActiveCallProps) {
  const [duration, setDuration] = useState(() => formatCallDuration(session.startedAt));
  const name = callerDisplayName(session);
  const phone = formatPhoneCallerId(session.phoneNumber);
  const subtitle = caseSubtitle(session, selectedCase);
  const direction = formatCaseLabel(session.direction);
  const caseLabel = session.caseTitle ?? "Unattached";

  useEffect(() => {
    setDuration(formatCallDuration(session.startedAt));
    const interval = window.setInterval(() => {
      setDuration(formatCallDuration(session.startedAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session.startedAt]);

  if (compact) {
    return (
      <section className="rounded-sm border border-[#25352c] bg-black/70 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 font-mono text-[7px] tracking-[0.12em] text-emerald-300/80">
            {direction.toUpperCase()} · {formatCaseLabel(session.participantType).toUpperCase()}
          </div>
          <div className="shrink-0 font-mono text-[9px] tracking-[0.08em] text-emerald-300">{duration}</div>
        </div>

        <div className="mt-2 flex flex-col items-center gap-1.5">
          <CallerIdIcon session={session} compact />
          <div className="w-full text-center">
            <div className="truncate font-mono text-[12px] tracking-[0.04em] text-emerald-300">{name}</div>
            <div className="font-mono text-[8px] tracking-[0.06em] text-[#b0b0b0]">{phone}</div>
            <div className="mt-1 truncate font-mono text-[7px] text-[#707070]">
              {caseLabel}
              {subtitle ? ` · ${subtitle}` : null}
            </div>
          </div>

          {onAttachToCase ? (
            <CyberdeckActionButton
              variant="neutral"
              disabled={controlsLocked}
              className="mt-0.5 text-[8px]"
              onClick={onAttachToCase}
            >
              Attach To Case
            </CyberdeckActionButton>
          ) : null}

          <button
            type="button"
            disabled={controlsLocked}
            aria-label="Hang up"
            onClick={onHangUp}
            className={cn(
              "mt-1 flex w-full max-w-[10rem] flex-col items-center justify-center gap-0.5 rounded-sm border-2 px-3 py-1.5 font-mono transition-colors",
              "border-rose-600/80 bg-rose-950/25 text-rose-400 hover:border-rose-500 hover:bg-rose-950/40 hover:text-rose-300",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <FcEndCall className="h-5 w-5" aria-hidden />
            <span className="text-[7px] tracking-[0.18em]">HANG UP</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-sm border border-[#25352c] bg-black/60 p-3">
        <div className="font-mono text-[7px] tracking-[0.14em] text-emerald-300/90">ACTIVE CALL</div>
        <dl className="mt-2.5 space-y-1.5 font-mono text-[9px] leading-snug">
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-[#606060]">Direction</dt>
            <dd className="text-right text-[#c8d8cf]">{direction}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-[#606060]">Participant</dt>
            <dd className="text-right text-[#c8d8cf]">{formatCaseLabel(session.participantType)}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-[#606060]">Name</dt>
            <dd className="text-right text-[#c8d8cf]">{name}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-[#606060]">Number</dt>
            <dd className="text-right text-[#c8d8cf]">{phone}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-[#606060]">Case</dt>
            <dd className="text-right text-[#c8d8cf]">
              <span className="block truncate">{caseLabel}</span>
              {subtitle ? (
                <span className="mt-0.5 block truncate text-[8px] text-[#707070]">{subtitle}</span>
              ) : null}
            </dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-[#606060]">Duration</dt>
            <dd className="text-right font-mono text-[10px] tracking-[0.08em] text-emerald-300">{duration}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-sm border border-[#25352c] bg-black/70 px-3 py-4">
        <div className="mb-4 text-center font-mono text-[8px] tracking-[0.14em] text-emerald-300/80">
          CALLER ID
        </div>
        <div className="flex flex-col items-center gap-3">
          <CallerIdIcon session={session} />
          <div className="text-center">
            <div className="truncate font-mono text-sm tracking-[0.04em] text-emerald-300">{name}</div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.06em] text-[#d0d0d0]">{phone}</div>
          </div>
          {onAttachToCase ? (
            <CyberdeckActionButton variant="neutral" disabled={controlsLocked} onClick={onAttachToCase}>
              Attach To Case
            </CyberdeckActionButton>
          ) : null}
          <button
            type="button"
            disabled={controlsLocked}
            aria-label="Hang up"
            onClick={onHangUp}
            className={cn(
              "flex w-full max-w-[11rem] flex-col items-center justify-center gap-1.5 rounded-sm border-2 px-4 py-3 font-mono transition-colors",
              "border-rose-600/80 bg-rose-950/25 text-rose-400 hover:border-rose-500 hover:bg-rose-950/40 hover:text-rose-300",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <FcEndCall className="h-8 w-8" aria-hidden />
            <span className="text-[9px] tracking-[0.18em]">HANG UP</span>
          </button>
        </div>
      </div>
    </section>
  );
}
