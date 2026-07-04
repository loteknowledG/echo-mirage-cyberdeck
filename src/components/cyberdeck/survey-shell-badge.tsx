"use client";

import { useEffect, useState } from "react";
import {
  resolveSurveyCyberdeckShell,
  type SurveyCyberdeckShellInfo,
} from "@/lib/electron/desktop-install.client";

function shellClassName(kind: SurveyCyberdeckShellInfo["kind"]): string {
  switch (kind) {
    case "desktop":
      return "border-emerald-900/60 bg-emerald-950/30 text-emerald-300/95";
    case "pwa":
      return "border-amber-900/60 bg-amber-950/30 text-amber-200/95";
    case "browser":
      return "border-cyan-900/50 bg-cyan-950/20 text-cyan-200/90";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function pairHint(shell: SurveyCyberdeckShellInfo): string {
  if (shell.canDirectPairEcho) {
    return "Direct Echo pair OK";
  }
  if (shell.kind === "pwa") {
    return "Use cloud relay or desktop";
  }
  return "Use cloud relay or desktop for remote Echo";
}

/** Shell indicator — stacks in the EMP rail on wide screens, inline at rail end on mobile. */
export function SurveyShellBadge() {
  const [shell, setShell] = useState<SurveyCyberdeckShellInfo | null>(null);

  useEffect(() => {
    setShell(resolveSurveyCyberdeckShell());
  }, []);

  if (!shell) return null;

  return (
    <div
      className={`survey-shell-badge shrink-0 rounded border px-2 py-1 font-mono text-[8px] leading-tight tracking-[0.06em] ${shellClassName(shell.kind)}`}
      title={`${shell.detail} · ${pairHint(shell)}`}
      aria-label={`Cyberdeck shell: ${shell.label}. ${shell.detail}. ${pairHint(shell)}.`}
    >
      <p className="survey-shell-badge-title font-semibold tracking-[0.12em]">SHELL // {shell.label}</p>
      <p className="survey-shell-badge-detail mt-0.5 max-w-[11rem] truncate text-[7px] opacity-85">
        {shell.detail}
      </p>
      <p className="survey-shell-badge-hint mt-0.5 text-[7px] opacity-75">{pairHint(shell)}</p>
    </div>
  );
}
