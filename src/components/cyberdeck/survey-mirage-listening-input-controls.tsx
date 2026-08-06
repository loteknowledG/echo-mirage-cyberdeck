"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckFilterButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { fetchMirageWhisperStatus } from "@/lib/cyberdeck/mirage-whisper-listening.client";
import {
  listSurveyListeningMicDevices,
  readSurveyListeningPreferences,
  setSurveyListeningPreferences,
  subscribeSurveyListeningPreferences,
  SURVEY_LISTENING_LANG_OPTIONS,
  warmSurveyListeningMicPermission,
  type SurveyListeningPreferences,
} from "@/lib/cyberdeck/survey-listening-preferences.client";

type SurveyMirageListeningInputControlsProps = {
  disabled?: boolean;
};

const selectClassName =
  "h-8 min-w-[10rem] max-w-full rounded-sm border border-[#1c1c1c] bg-black/80 px-2 text-[10px] text-[#c8c8c8] outline-none focus:border-emerald-500/40";

/** Language, mic, and raw-audio toggles for Mirage local STT. */
export function SurveyMirageListeningInputControls({
  disabled = false,
}: SurveyMirageListeningInputControlsProps) {
  const [prefs, setPrefs] = useState<SurveyListeningPreferences>(() =>
    readSurveyListeningPreferences(),
  );
  const [micOptions, setMicOptions] = useState<Array<{ deviceId: string; label: string }>>([
    { deviceId: "", label: "System default mic" },
  ]);
  const [micBusy, setMicBusy] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState<{
    available: boolean;
    provider?: string;
    model?: string;
    error?: string;
  } | null>(null);

  useEffect(() => subscribeSurveyListeningPreferences(setPrefs), []);

  useEffect(() => {
    void fetchMirageWhisperStatus().then(setWhisperStatus);
  }, [prefs.sttEngine]);

  const refreshMicList = useCallback(async (requestPermission: boolean) => {
    setMicBusy(true);
    try {
      if (requestPermission) {
        await warmSurveyListeningMicPermission();
      }
      const devices = await listSurveyListeningMicDevices();
      setMicOptions([{ deviceId: "", label: "System default mic" }, ...devices]);
    } finally {
      setMicBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshMicList(false);
  }, [refreshMicList]);

  return (
    <div
      className="mb-3 space-y-2 rounded-sm border border-[#141414] bg-black/50 p-2"
      data-testid="survey-mirage-listening-input-controls"
    >
      <p className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">STT INPUT</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CyberdeckFilterButton
          active={prefs.sttEngine === "whisper"}
          disabled={disabled || whisperStatus?.available === false}
          onClick={() => setSurveyListeningPreferences({ sttEngine: "whisper" })}
          data-testid="survey-mirage-listening-engine-whisper"
        >
          WHISPER
        </CyberdeckFilterButton>
        <CyberdeckFilterButton
          active={prefs.sttEngine === "web-speech"}
          disabled={disabled}
          onClick={() => setSurveyListeningPreferences({ sttEngine: "web-speech" })}
          data-testid="survey-mirage-listening-engine-browser"
        >
          BROWSER STT
        </CyberdeckFilterButton>
        <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
          {prefs.sttEngine === "whisper"
            ? whisperStatus?.available
              ? `Whisper ready (${whisperStatus.provider ?? "server"} · ${whisperStatus.model ?? "whisper-1"}) — works on Vercel with OPENAI_API_KEY.`
              : whisperStatus?.error ||
                "Whisper not configured on server — set OPENAI_API_KEY in Vercel env, or use Browser STT."
            : "Browser STT uses Chrome speech (fast, less accurate)."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex flex-col gap-1 text-[9px] text-[#6a6a6a]">
          Language
          <select
            className={selectClassName}
            disabled={disabled}
            value={prefs.lang}
            onChange={(event) =>
              setSurveyListeningPreferences({
                lang: event.target.value as SurveyListeningPreferences["lang"],
              })
            }
            data-testid="survey-mirage-listening-lang"
          >
            {SURVEY_LISTENING_LANG_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[9px] text-[#6a6a6a]">
          Microphone
          <select
            className={selectClassName}
            disabled={disabled || micBusy}
            value={prefs.micDeviceId}
            onChange={(event) =>
              setSurveyListeningPreferences({ micDeviceId: event.target.value })
            }
            data-testid="survey-mirage-listening-mic"
          >
            {micOptions.map((option) => (
              <option key={option.deviceId || "default"} value={option.deviceId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="mt-4 h-8 rounded-sm border border-[#1c1c1c] px-2 text-[9px] tracking-[0.06em] text-[#9a9a9a] hover:border-emerald-500/30 hover:text-emerald-200/90 disabled:opacity-40"
          disabled={disabled || micBusy}
          onClick={() => void refreshMicList(true)}
          data-testid="survey-mirage-listening-mic-refresh"
        >
          {micBusy ? "SCAN…" : "REFRESH MICS"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CyberdeckFilterButton
          active={prefs.rawMic}
          disabled={disabled}
          onClick={() => setSurveyListeningPreferences({ rawMic: !prefs.rawMic })}
          data-testid="survey-mirage-listening-raw-mic"
        >
          RAW MIC
        </CyberdeckFilterButton>
        <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
          RAW MIC turns off noise suppression. Whisper updates every ~5s; pause between phrases.
          SOLVE uses finalized transcript only.
        </p>
      </div>
    </div>
  );
}
