export const CHARACTER_TTS_PROFILE_OPTIONS = [
  { id: "jenny-neural", label: "Jenny Neural", description: "Clean styled profile." },
  { id: "jenna-jacket", label: "Jenna Jacket", description: "Friendly operator profile." },
  { id: "muthur", label: "MUTHUR", description: "Calm system voice with reverb." },
  { id: "asian-elder", label: "Asian Elder", description: "Slow older male voice with East Asian accent." },
  {
    id: "vietnamese-male",
    label: "Vietnamese Male",
    description: "Natural Vietnamese male voice for English dialogue.",
  },
  { id: "midwest-teen", label: "Midwest Teen", description: "16-year-old Midwestern female, bright and casual." },
  { id: "narrator", label: "Narrator", description: "Slow, clear audiobook and documentary narration." },
  {
    id: "narrator-female",
    label: "Female Narrator",
    description: "Warm measured female narration for stories.",
  },
  {
    id: "seductive-secretary",
    label: "Seductive Secretary",
    description: "Slow, smooth, low office femme fatale tone.",
  },
  { id: "southern-belle", label: "Southern Belle", description: "Warm, slow, gracious Southern female voice." },
  { id: "uk-twenties", label: "UK Twenties", description: "British woman in her 20s, casual modern accent." },
  { id: "au-twenties", label: "AU Twenties", description: "Australian woman in her 20s, upbeat casual accent." },
  {
    id: "atlanta-thirties",
    label: "Atlanta 30s",
    description: "Atlanta woman in her 30s, warm urban Southern tone.",
  },
  {
    id: "california-girl",
    label: "California Girl",
    description: "Bright relaxed SoCal female, casual West Coast vibe.",
  },
  { id: "nyc-girl", label: "NYC Girl", description: "Fast direct New York City female, urban and confident." },
  {
    id: "atlanta-forties-male",
    label: "Atlanta 40s Male",
    description: "Atlanta man in his 40s, warm urban Southern tone.",
  },
  { id: "stripper-female", label: "Stripper", description: "Slow husky club voice, playful and flirtatious." },
] as const;

export const CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL = [...CHARACTER_TTS_PROFILE_OPTIONS].sort(
  (a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
);

export type CharacterTtsProfileId = (typeof CHARACTER_TTS_PROFILE_OPTIONS)[number]["id"];

export type CharacterTtsVoice = {
  engine: "profile";
  profileId: CharacterTtsProfileId;
};

export const DEFAULT_CHARACTER_TTS_VOICE: CharacterTtsVoice = {
  engine: "profile",
  profileId: "jenny-neural",
};

function normalizeProfileId(value: unknown): CharacterTtsProfileId | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "jenny" || normalized === "jenny-neural") return "jenny-neural";
  if (normalized === "jenna" || normalized === "jenna-jacket" || normalized === "jacket") {
    return "jenna-jacket";
  }
  if (normalized === "muthur" || normalized === "mother") return "muthur";
  return CHARACTER_TTS_PROFILE_OPTIONS.find((option) => option.id === normalized)?.id;
}

export function normalizeCharacterTtsProfile(value: unknown): CharacterTtsProfileId {
  return normalizeProfileId(value) ?? "jenny-neural";
}

export function normalizeCharacterTtsVoice(
  value: unknown,
  legacyProfile?: unknown,
): CharacterTtsVoice {
  let profileId: CharacterTtsProfileId = DEFAULT_CHARACTER_TTS_VOICE.profileId;
  let hasExplicitProfile = false;

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const fromObject = normalizeProfileId(record.profileId);
    if (fromObject) {
      profileId = fromObject;
      hasExplicitProfile = true;
    }
  } else {
    const fromValue = normalizeProfileId(value);
    if (fromValue) {
      profileId = fromValue;
      hasExplicitProfile = true;
    }
  }

  if (!hasExplicitProfile) {
    const legacy = normalizeProfileId(legacyProfile);
    if (legacy) profileId = legacy;
  }

  return { engine: "profile", profileId };
}

export function resolveCharacterTtsVoice(
  value?: CharacterTtsVoice | null,
  legacyProfile?: unknown,
): CharacterTtsVoice {
  return normalizeCharacterTtsVoice(value, legacyProfile);
}

export function characterTtsVoiceLabel(settings: CharacterTtsVoice): string {
  const profile = settings.profileId ?? DEFAULT_CHARACTER_TTS_VOICE.profileId;
  return CHARACTER_TTS_PROFILE_OPTIONS.find((option) => option.id === profile)?.label ?? profile;
}
