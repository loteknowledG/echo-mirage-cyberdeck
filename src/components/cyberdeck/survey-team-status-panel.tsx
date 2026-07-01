"use client";

import { useCallback, useState } from "react";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_POWERFIST_DISPLAY,
  SURVEY_POWERFIST_HINT,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import type { SpyTeamLink } from "@/lib/cyberdeck/survey-team-status";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";

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

export function SurveyTeamStatusPanel() {
  const { refresh, ...team } = useSurveyTeamStatus();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <section
      className="border-b border-[#1c1c1c] bg-[#060606] px-4 py-3 font-mono"
      aria-label="Survey team link status"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[9px] tracking-[0.14em] text-[#9a9a9a]">TEAM LINKS</p>
        <div className="flex items-center gap-2">
          {team.echoHost ? (
            <p className="text-[8px] tracking-[0.06em] text-[#5f5f5f]">
              {SURVEY_ECHO_DISPLAY} @ {team.echoHost}
            </p>
          ) : null}
          <CyberdeckActionButton disabled={refreshing || team.loading} onClick={() => void handleRefresh()}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </CyberdeckActionButton>
        </div>
      </div>

      {team.loading ? (
        <p className="text-[9px] text-[#8a8a8a]">Checking team links…</p>
      ) : (
        <>
          <TeamLinkRow left={SURVEY_ECHO_DISPLAY} right={SURVEY_MIRAGE_DISPLAY} link={team.echoMirage} />
          <TeamLinkRow
            left={SURVEY_ECHO_DISPLAY}
            right={`${SURVEY_POWERFIST_DISPLAY} (${SURVEY_POWERFIST_HINT})`}
            link={team.echoPowerfist}
          />
          <TeamLinkRow
            left={SURVEY_MIRAGE_DISPLAY}
            right={`${SURVEY_POWERFIST_DISPLAY} (${SURVEY_POWERFIST_HINT})`}
            link={team.miragePowerfist}
          />
        </>
      )}
    </section>
  );
}
