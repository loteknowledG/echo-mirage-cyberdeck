"use client";

import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_POWERFIST_DISPLAY,
  ESPIONAGE_POWERFIST_HINT,
} from "@/lib/cyberdeck/espionage-mode";
import { useSpyTeamStatus } from "@/lib/cyberdeck/use-spy-team-status";
import type { SpyTeamLink } from "@/lib/cyberdeck/spy-team-status";

function linkLabel(link: SpyTeamLink): string {
  switch (link.state) {
    case "linked":
      return "LINKED";
    case "terminated":
      return "STALE";
    case "not-linked":
      return "NOT LINKED";
    default:
      return "…";
  }
}

function linkClass(link: SpyTeamLink): string {
  switch (link.state) {
    case "linked":
      return "text-emerald-300/90";
    case "terminated":
      return "text-amber-300/90";
    case "not-linked":
      return "text-[#6a6a6a]";
    default:
      return "text-[#8a8a8a]";
  }
}

function TeamLinkRow({
  left,
  right,
  link,
}: {
  left: string;
  right: string;
  link: SpyTeamLink;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[#151515] py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">
          {left} ↔ {right}
        </span>
        <span className={`text-[9px] font-semibold tracking-[0.12em] ${linkClass(link)}`}>
          {linkLabel(link)}
        </span>
      </div>
      {link.detail ? <span className="text-[8px] leading-relaxed text-[#5f5f5f]">{link.detail}</span> : null}
    </div>
  );
}

export function SpyTeamStatusPanel() {
  const team = useSpyTeamStatus();

  return (
    <section
      className="border-b border-[#1c1c1c] bg-[#060606] px-4 py-3 font-mono"
      aria-label="Espionage team link status"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[9px] tracking-[0.14em] text-[#9a9a9a]">TEAM LINKS</p>
        {team.echoHost ? (
          <p className="text-[8px] tracking-[0.06em] text-[#5f5f5f]">
            {ESPIONAGE_ECHO_DISPLAY} @ {team.echoHost}
          </p>
        ) : null}
      </div>

      {team.loading ? (
        <p className="text-[9px] text-[#8a8a8a]">Checking team links…</p>
      ) : (
        <>
          <TeamLinkRow left={ESPIONAGE_ECHO_DISPLAY} right={ESPIONAGE_MIRAGE_DISPLAY} link={team.echoMirage} />
          <TeamLinkRow
            left={ESPIONAGE_ECHO_DISPLAY}
            right={`${ESPIONAGE_POWERFIST_DISPLAY} (${ESPIONAGE_POWERFIST_HINT})`}
            link={team.echoPowerfist}
          />
          <TeamLinkRow
            left={ESPIONAGE_MIRAGE_DISPLAY}
            right={`${ESPIONAGE_POWERFIST_DISPLAY} (${ESPIONAGE_POWERFIST_HINT})`}
            link={team.miragePowerfist}
          />
        </>
      )}
    </section>
  );
}
