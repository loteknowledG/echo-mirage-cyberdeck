"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  SURVEY_MODE_TITLE,
  surveyRoleLabel,
  surveyTeamSummary,
  readSurveyNodeRole,
  writeSurveyNodeRole,
  type SurveyNodeRole,
} from "@/lib/cyberdeck/survey-mode";

function RoleBadge({ role }: { role: SurveyNodeRole }) {
  const tone =
    role === "echo"
      ? "text-cyan-300/90"
      : role === "mirage"
        ? "text-fuchsia-300/90"
        : "text-[#8a8a8a]";
  return (
    <span className={`font-mono text-[11px] tracking-[0.12em] ${tone}`}>
      {SURVEY_MODE_TITLE} // {surveyRoleLabel(role)}
    </span>
  );
}

/** Settings shortcut — full Survey UI lives in the Survey tab. */
export function SettingsPowerfistPairingSection() {
  const [role, setRole] = useState<SurveyNodeRole>("off");

  useEffect(() => {
    setRole(readSurveyNodeRole());
  }, []);

  const handleRoleChange = useCallback((next: SurveyNodeRole) => {
    writeSurveyNodeRole(next);
    setRole(next);
  }, []);

  return (
    <section className="flex flex-col gap-2" data-testid="settings-survey-mode">
      <RoleBadge role={role} />
      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
        <p className="mb-3 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          {surveyTeamSummary(role)}
        </p>
        <p className="mb-4 text-[9px] text-[#6a6a8a]">
          Open the <strong className="font-normal text-[#9a9a9a]">Spy</strong> rail tab for Echo /
          Mirage / PowerFist sub-panes, capture, vision analysis, and pairing QRs.
        </p>
        <div className="flex flex-wrap gap-2">
          <CyberdeckActionButton onClick={() => handleRoleChange("mirage")}>This machine is Mirage</CyberdeckActionButton>
          <CyberdeckActionButton onClick={() => handleRoleChange("echo")}>This machine is Echo</CyberdeckActionButton>
          {role !== "off" ? (
            <CyberdeckActionButton onClick={() => handleRoleChange("off")}>Survey off</CyberdeckActionButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
