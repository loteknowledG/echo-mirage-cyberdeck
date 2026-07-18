"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { Knob } from "@/components/ui/knob";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_CURSOR_TTS_PROFILE_ID } from "@/lib/cursorTtsProfiles";
import {
  clampCursorTtsVolumeUi,
  CURSOR_TTS_VOLUME_UI_DEFAULT,
  CURSOR_TTS_VOLUME_UI_MAX,
  CURSOR_TTS_VOLUME_UI_MIN,
} from "@/lib/cursorTtsVolume";
import { cn } from "@/lib/utils";
import { getVoiceProfileOptions } from "@/lib/voice-profiles";

const MECHANICUS_CURSOR_BRIDGE = "/__cyberdeck/mechanicus-cursor";

const SWITCH_LEGACY_EMERALD =
  "data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-[#2a2a2a]";

type VoiceHealth = "idle" | "backend" | "fallback" | "off";

type VoiceLabPaneBodyProps = {
  voiceEnabled: boolean;
  voiceHealth: VoiceHealth;
  voiceVolume: number;
  onVoiceToggle: () => void;
  onVoiceVolumeChange: (volume: number) => void;
  onVoiceTest: () => void;
};

function clampMuthurVolume(volume: number) {
  return Math.min(1.25, Math.max(0.05, volume));
}

function normalizeProfileId(value: unknown) {
  return String(value || "")
    .replace(/(?:-copy)+$/i, "")
    .trim();
}

export function CyberdeckVoiceLabPaneBody({
  voiceEnabled,
  voiceHealth,
  voiceVolume,
  onVoiceToggle,
  onVoiceVolumeChange,
  onVoiceTest,
}: VoiceLabPaneBodyProps) {
  const [cursorMuted, setCursorMuted] = useState(false);
  const [cursorVolume, setCursorVolume] = useState(CURSOR_TTS_VOLUME_UI_DEFAULT);
  const [cursorProfile, setCursorProfile] = useState(DEFAULT_CURSOR_TTS_PROFILE_ID);
  const [cursorBridge, setCursorBridge] = useState<boolean | null>(null);
  const [cursorBusy, setCursorBusy] = useState(false);
  const [cursorError, setCursorError] = useState<string | null>(null);
  const [profileNonce, setProfileNonce] = useState(0);

  const profileOptions = useMemo(() => getVoiceProfileOptions(), [profileNonce]);

  const refreshCursor = useCallback(async () => {
    try {
      const response = await fetch(MECHANICUS_CURSOR_BRIDGE, { method: "GET" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        muted?: boolean;
        profile?: string;
        volume?: number;
        bridge?: boolean;
      };
      setCursorMuted(!!payload.muted);
      if (typeof payload.profile === "string" && payload.profile) {
        setCursorProfile(normalizeProfileId(payload.profile));
      }
      if (typeof payload.volume === "number" && Number.isFinite(payload.volume)) {
        setCursorVolume(clampCursorTtsVolumeUi(payload.volume));
      }
      setCursorBridge(!!payload.bridge);
      setCursorError(null);
      return payload;
    } catch (error) {
      setCursorBridge(false);
      setCursorError(String((error as Error)?.message || error));
      return null;
    }
  }, []);

  const postCursorState = useCallback(
    async (patch: { muted?: boolean; profile?: string; volume?: number }) => {
      const volumeOnly =
        Object.keys(patch).length === 1 &&
        "volume" in patch &&
        !("muted" in patch) &&
        !("profile" in patch);
      if (!volumeOnly) setCursorBusy(true);
      setCursorError(null);
      try {
        const nextMuted = "muted" in patch ? !!patch.muted : cursorMuted;
        const nextProfile = normalizeProfileId(
          "profile" in patch ? patch.profile : cursorProfile,
        );
        const nextVolume =
          "volume" in patch && typeof patch.volume === "number" && Number.isFinite(patch.volume)
            ? clampCursorTtsVolumeUi(patch.volume)
            : cursorVolume;
        const response = await fetch(MECHANICUS_CURSOR_BRIDGE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            muted: nextMuted,
            profile: nextProfile,
            volume: nextVolume,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as {
          muted?: boolean;
          profile?: string;
          volume?: number;
          bridge?: boolean;
          error?: string;
        };
        if (payload.error) throw new Error(payload.error);
        setCursorMuted(!!payload.muted);
        if (typeof payload.profile === "string" && payload.profile) {
          setCursorProfile(normalizeProfileId(payload.profile));
        }
        if (typeof payload.volume === "number" && Number.isFinite(payload.volume)) {
          setCursorVolume(clampCursorTtsVolumeUi(payload.volume));
        }
        setCursorBridge(true);
        setProfileNonce((n) => n + 1);
      } catch (error) {
        setCursorError(String((error as Error)?.message || error));
        setCursorBridge(false);
      } finally {
        if (!volumeOnly) setCursorBusy(false);
      }
    },
    [cursorMuted, cursorProfile, cursorVolume],
  );

  useEffect(() => {
    void refreshCursor();
  }, [refreshCursor]);

  const cursorSpeechOn = !cursorMuted;
  const muthurVolumePct = Math.round(clampMuthurVolume(voiceVolume) * 100);

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                VOICE LAB
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                MUTHUR CHANNEL // CURSOR HOOK TTS
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 font-mono text-[10px]">
          <section className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">IN-DECK MUTHUR</div>
                <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
                  Speaks assistant replies in the cyberdeck chat column.
                </div>
              </div>
              <Switch
                checked={voiceEnabled}
                onCheckedChange={() => onVoiceToggle()}
                aria-label={voiceEnabled ? "MUTHUR voice on" : "MUTHUR voice off"}
                className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] tracking-[0.06em] text-[#5f5f5f]">
              <span>
                HEALTH <span className="text-[#9a9a9a]">{voiceHealth.toUpperCase()}</span>
              </span>
              <span>
                LEVEL <span className="text-[#9a9a9a]">{muthurVolumePct}%</span>
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div
                style={{ touchAction: "none" }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                title={`MUTHUR voice ${muthurVolumePct}%`}
              >
                <Knob
                  label="LEVEL"
                  unit="%"
                  min={5}
                  max={125}
                  step={1}
                  value={muthurVolumePct}
                  onValueChange={(next) => onVoiceVolumeChange(clampMuthurVolume(next / 100))}
                  wheelMultiplier={1.2}
                  dragMultiplier={1.5}
                  size="sm"
                  theme="dark"
                  showReadout={false}
                  showLabel
                  className="w-16"
                  disabled={!voiceEnabled}
                />
              </div>
              <button
                type="button"
                disabled={!voiceEnabled}
                onClick={onVoiceTest}
                className="rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-[9px] tracking-[0.1em] text-[#9a9a9a] transition-colors hover:border-[#3a3a3a] hover:text-[#c8c8c8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                TEST SPEAK
              </button>
            </div>
          </section>

          <section className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">CURSOR AFTER-REPLY TTS</div>
                <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
                  Writes mute / profile / volume into{" "}
                  <span className="text-[#9a9a9a]">.cursor/hooks/</span> via the local bridge.
                </div>
              </div>
              <Switch
                checked={cursorSpeechOn}
                disabled={cursorBusy || cursorBridge === false}
                onCheckedChange={(checked) => {
                  void postCursorState({ muted: !checked });
                }}
                aria-label={cursorSpeechOn ? "Cursor TTS on" : "Cursor TTS off"}
                className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] tracking-[0.06em] text-[#5f5f5f]">
              <span>
                BRIDGE{" "}
                <span className="text-[#9a9a9a]">
                  {cursorBridge == null ? "…" : cursorBridge ? "LIVE" : "DOWN"}
                </span>
              </span>
              <span>
                LEVEL <span className="text-[#9a9a9a]">{cursorVolume}</span>
              </span>
              <button
                type="button"
                onClick={() => void refreshCursor()}
                className="tracking-[0.1em] text-[#7a7a7a] underline-offset-2 hover:text-[#b0b0b0] hover:underline"
              >
                REFRESH
              </button>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[9px] tracking-[0.06em] text-[#8a8a8a]" htmlFor="cursor-tts-profile">
                PROFILE
              </label>
              <select
                id="cursor-tts-profile"
                value={cursorProfile}
                disabled={cursorBusy || cursorBridge === false}
                onChange={(event) => {
                  const next = normalizeProfileId(event.target.value);
                  setCursorProfile(next);
                  void postCursorState({ profile: next });
                }}
                className="w-full max-w-md rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1.5 text-[10px] tracking-[0.04em] text-[#b0b0b0] outline-none focus:border-[#3a3a3a] disabled:opacity-40"
              >
                {profileOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.value})
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{ touchAction: "none" }}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              title={`Cursor TTS volume ${cursorVolume}`}
            >
              <Knob
                label="LEVEL"
                unit=""
                min={CURSOR_TTS_VOLUME_UI_MIN}
                max={CURSOR_TTS_VOLUME_UI_MAX}
                step={1}
                value={cursorVolume}
                onValueChange={(next) => {
                  const clamped = clampCursorTtsVolumeUi(next);
                  setCursorVolume(clamped);
                  void postCursorState({ volume: clamped });
                }}
                wheelMultiplier={1.2}
                dragMultiplier={1.5}
                size="sm"
                theme="dark"
                showReadout={false}
                showLabel
                className="w-16"
                disabled={cursorBusy || cursorBridge === false}
              />
            </div>

            {cursorError ? (
              <div className="mt-3 text-[9px] tracking-[0.04em] text-red-400/90">{cursorError}</div>
            ) : null}
            {cursorBridge === false && !cursorError ? (
              <div className="mt-3 text-[9px] tracking-[0.04em] text-[#7a6a3a]">
                Bridge unreachable — run the cyberdeck server locally, or edit hook files by hand.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
