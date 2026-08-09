"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";
import {
  CHARACTER_TTS_PROFILE_OPTIONS,
  CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL,
  characterTtsVoiceLabel,
  normalizeCharacterTtsVoice,
  resolveCharacterTtsVoice,
  type CharacterTtsProfileId,
  type CharacterTtsVoice,
} from "@/lib/character-tts-profile";
import {
  MUTHUR_VOICE_LAB_CHANGED_EVENT,
  readMuthurVoiceLabEnabled,
  writeMuthurVoiceLabEnabled,
} from "@/lib/cyberdeck/muthur-voice-lab.client";
import {
  previewVoiceLabProfile,
  readVoiceLabStoredProfile,
  unlockVoiceLabAudioPlayback,
  writeVoiceLabStoredProfile,
} from "@/lib/cyberdeck/voice-lab-tts.client";
import { cn } from "@/lib/utils";

const DEFAULT_PREVIEW_TEXT = "Hello. This is how I will sound when I speak.";
const selectClassName =
  "h-8 w-full rounded-sm border border-[#1c1c1c] bg-black/80 px-2 text-[10px] text-[#c8c8c8] outline-none focus:border-emerald-500/40";
const SWITCH_LEGACY_EMERALD =
  "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]";

/** Voice Lab — m4trix voice profiles with Edge TTS preview (works on Vercel). */
export function CyberdeckVoiceLabPaneBody() {
  const [voice, setVoice] = useState<CharacterTtsVoice>(() => readVoiceLabStoredProfile());
  const [useForMuthur, setUseForMuthur] = useState(() => readMuthurVoiceLabEnabled());
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [activeProfileId, setActiveProfileId] = useState<CharacterTtsProfileId | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    writeVoiceLabStoredProfile(voice);
  }, [voice]);

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setUseForMuthur(detail?.enabled ?? readMuthurVoiceLabEnabled());
    };
    window.addEventListener(MUTHUR_VOICE_LAB_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(MUTHUR_VOICE_LAB_CHANGED_EVENT, onChanged);
  }, []);

  const settings = resolveCharacterTtsVoice(voice);
  const selectedOption = CHARACTER_TTS_PROFILE_OPTIONS.find(
    (option) => option.id === settings.profileId,
  );

  const runPreview = useCallback(
    async (profileId: CharacterTtsProfileId, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setStatus("Add preview text first.");
        return;
      }
      setActiveProfileId(profileId);
      setStatus(`Synthesizing ${profileId}…`);
      unlockVoiceLabAudioPlayback();
      const result = await previewVoiceLabProfile(trimmed, profileId, { allowFallback: true });
      setActiveProfileId(null);
      if (!result.ok) {
        setStatus(result.error || "Preview failed.");
        return;
      }
      setStatus(`Played ${profileId}.`);
    },
    [],
  );

  const handlePrimaryPreview = () => {
    unlockVoiceLabAudioPlayback();
    void runPreview(settings.profileId, previewText);
  };

  return (
    <div
      className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3"
      data-testid="voice-lab-pane-body"
    >
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                VOICE LAB
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                EDGE TTS // {CHARACTER_TTS_PROFILE_OPTIONS.length} STYLED PROFILES
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <section
            className="space-y-2 rounded-sm border border-[#1c1c1c] bg-black/70 p-3"
            data-testid="voice-lab-profile-editor"
          >
            <div>
              <div className="text-[10px] font-medium tracking-[0.08em] text-[#9a9a9a]">
                Voice profile
              </div>
              <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
                Local styled voices rendered via Edge TTS on the cyberdeck server (Vercel-compatible).
              </p>
            </div>

            <label className="grid gap-1">
              <span className="text-[9px] tracking-[0.06em] text-[#6a6a6a]">Profile</span>
              <select
                className={selectClassName}
                value={settings.profileId}
                onChange={(event) =>
                  setVoice(normalizeCharacterTtsVoice({ profileId: event.target.value }))
                }
                data-testid="voice-lab-profile-select"
              >
                {CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedOption?.description ? (
              <p className="text-[9px] leading-relaxed text-[#6a6a6a]">{selectedOption.description}</p>
            ) : null}

            <label className="grid gap-1">
              <span className="text-[9px] tracking-[0.06em] text-[#6a6a6a]">Preview text</span>
              <textarea
                className="min-h-[3rem] w-full resize-y rounded-sm border border-[#1c1c1c] bg-black/80 px-2 py-1.5 font-mono text-[10px] text-[#c8c8c8] outline-none focus:border-emerald-500/40"
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                data-testid="voice-lab-preview-text"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9px] text-[#7a7a7a]">{characterTtsVoiceLabel(settings)}</span>
              <CyberdeckActionButton
                disabled={activeProfileId !== null}
                onPointerDown={() => unlockVoiceLabAudioPlayback()}
                onClick={handlePrimaryPreview}
                data-testid="voice-lab-preview-primary"
              >
                {activeProfileId === settings.profileId ? "PLAYING…" : "PREVIEW VOICE"}
              </CyberdeckActionButton>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-3">
              <div className="min-w-0">
                <div className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">USE FOR MUTHUR</div>
                <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
                  {useForMuthur
                    ? `MUTHUR speaks with ${characterTtsVoiceLabel(settings)} via Edge TTS.`
                    : "MUTHUR uses the locked ship-computer voice preset."}
                </div>
              </div>
              <Switch
                checked={useForMuthur}
                onCheckedChange={(checked) => {
                  writeMuthurVoiceLabEnabled(checked);
                  setUseForMuthur(checked);
                  setStatus(
                    checked
                      ? `MUTHUR will use ${characterTtsVoiceLabel(settings)}.`
                      : "MUTHUR voice preset restored.",
                  );
                }}
                aria-label={useForMuthur ? "Voice Lab profile active for MUTHUR" : "Use Voice Lab profile for MUTHUR"}
                className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
                data-testid="voice-lab-use-for-muthur"
              />
            </div>
          </section>

          <section className="min-h-0 flex-1 rounded-sm border border-[#1c1c1c] bg-black/70 p-3">
            <div className="mb-2 text-[9px] tracking-[0.1em] text-[#8a8a8a]">
              ALL PROFILES // tap preview
            </div>
            <ul
              className="custom-scrollbar max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1"
              data-testid="voice-lab-profile-list"
            >
              {CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL.map((option) => {
                const isPlaying = activeProfileId === option.id;
                const isSelected = settings.profileId === option.id;
                return (
                  <li
                    key={option.id}
                    className={`flex flex-wrap items-start justify-between gap-2 rounded-sm border px-2 py-2 ${
                      isSelected
                        ? "border-emerald-500/30 bg-emerald-950/20"
                        : "border-[#141414] bg-black/50"
                    }`}
                    data-testid={`voice-lab-profile-row-${option.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] tracking-[0.04em] text-[#d0d0d0]">{option.label}</div>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-[#5f5f5f]">
                        {option.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="text-[9px] tracking-[0.06em] text-[#6a6a6a] hover:text-emerald-300/90"
                        onClick={() => {
                          setVoice(normalizeCharacterTtsVoice({ profileId: option.id }));
                          if (useForMuthur) {
                            setStatus(`MUTHUR will use ${option.label}.`);
                          }
                        }}
                      >
                        SELECT
                      </button>
                      <CyberdeckActionButton
                        disabled={activeProfileId !== null}
                        onPointerDown={() => unlockVoiceLabAudioPlayback()}
                        onClick={() => void runPreview(option.id, previewText)}
                        data-testid={`voice-lab-preview-${option.id}`}
                      >
                        {isPlaying ? "…" : "PREVIEW"}
                      </CyberdeckActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {status ? (
            <p className="text-[9px] tracking-[0.04em] text-[#7a7a7a]" data-testid="voice-lab-status">
              {status}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
