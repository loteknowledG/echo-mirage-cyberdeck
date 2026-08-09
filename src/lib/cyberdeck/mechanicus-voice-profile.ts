import type { CharacterTtsProfileId } from "@/lib/character-tts-profile";

export const MECHANICUS_VOICE_PROFILE_ID = "mechanicus-voice" as const satisfies CharacterTtsProfileId;

export function isMechanicusVoiceProfile(profile: unknown): profile is typeof MECHANICUS_VOICE_PROFILE_ID {
  if (typeof profile !== "string") return false;
  const normalized = profile.trim().toLowerCase();
  return (
    normalized === MECHANICUS_VOICE_PROFILE_ID ||
    normalized === "mechanicus" ||
    normalized === "tech-priest" ||
    normalized === "tech priest"
  );
}
