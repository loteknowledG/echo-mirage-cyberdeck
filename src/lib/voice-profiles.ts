export type VoiceProfile = {
  id: string;
  label: string;
  description: string;
  browserVoice: string;
  nativeVoice: string;
  forceNativeTTS: boolean;
  rate: number;
  pitch: number;
  volume: number;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
  effect: string;
  aliases: string[];
  modelMode?: string;
  language?: string;
};

export const voiceProfiles: VoiceProfile[] = [
  {
    id: "jenna-jacket",
    label: "Jeena Jacket",
    description: "Friendly default operator profile.",
    browserVoice: "en-US-JennyNeural",
    nativeVoice: "Microsoft Zira Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 0.81,
    pitch: 0.91,
    volume: 0.96,
    ttsRate: -19,
    ttsPitch: -9,
    ttsVolume: 2,
    effect: "",
    aliases: ["jenna", "jeena", "jacket", "assistant", "friendly"],
  },
  {
    id: "mechanicus-voice",
    label: "Tech Priest",
    description: "Dark, ritualistic machine-liturgy voice for sci-fi narration.",
    browserVoice: "en-US-AndrewNeural",
    nativeVoice: "Microsoft David Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 0.72,
    pitch: 0.76,
    volume: 0.96,
    ttsRate: -24,
    ttsPitch: -10,
    ttsVolume: 0,
    effect: "mechanicus",
    aliases: ["mechanicus", "machine liturgy", "tech priest", "adeptus mechanicus", "war chant"],
  },
  {
    id: "codex-scribe",
    label: "Codex Datasmith Scribe",
    description:
      "Cold archive voice with metallic circuitry and binary chatter for Codex commentary, recall, and datasmith-litany output.",
    browserVoice: "en-US-AriaNeural",
    nativeVoice: "Microsoft David Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 0.86,
    pitch: 0.72,
    volume: 0.97,
    ttsRate: -10,
    ttsPitch: -5,
    ttsVolume: 1,
    effect: "codex",
    aliases: ["codex", "scribe", "archive", "vault", "librarian"],
  },
  {
    id: "warp-spider",
    label: "Warp Spider",
    description:
      "Small-engine / lawnmower talk: low roar, idle pulse + fast buzz, short metal ring, grain; slips (up to 4× / 4 words, rarer at max).",
    browserVoice: "en-US-GuyNeural",
    nativeVoice: "Microsoft Zira Desktop - English (United States)",
    forceNativeTTS: false,
    rate: 1.18,
    pitch: 1.34,
    volume: 0.96,
    ttsRate: -10,
    ttsPitch: -5,
    ttsVolume: 5,
    effect: "warp-spider",
    aliases: ["warp spider", "warp-spider", "warp", "phase voice", "flicker voice"],
  },
];

export const CUSTOM_VOICE_PROFILES_KEY = "emc_custom_voice_profiles_v1";
const DEFAULT_MODEL_MODE = "tts";
const DEFAULT_LANGUAGE = "en-US";

function normalizeVoiceProfile(profile: VoiceProfile): VoiceProfile {
  return {
    ...profile,
    modelMode: profile.modelMode || DEFAULT_MODEL_MODE,
    language: profile.language || DEFAULT_LANGUAGE,
  };
}

function readStoredVoiceProfiles(): VoiceProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_VOICE_PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAllVoiceProfiles(): VoiceProfile[] {
  return [...voiceProfiles.map(normalizeVoiceProfile), ...readStoredVoiceProfiles().map(normalizeVoiceProfile)];
}

export function getBaseVoiceProfiles(): VoiceProfile[] {
  return voiceProfiles.map(normalizeVoiceProfile);
}

export function resolveVoiceProfile(profileName = ""): VoiceProfile {
  const key = String(profileName || "").trim().toLowerCase();
  const allProfiles = getAllVoiceProfiles();
  const aliasMap = Object.fromEntries(
    allProfiles.flatMap((profile) => [
      [profile.id, profile.id],
      ...(profile.aliases || []).map((alias) => [String(alias).toLowerCase(), profile.id]),
    ]),
  );
  const normalized = aliasMap[key] || key;
  return normalizeVoiceProfile(
    allProfiles.find((profile) => profile.id === normalized) || allProfiles[0],
  );
}

export function getVoiceProfileOptions() {
  return getAllVoiceProfiles().map((profile) => ({
    label: profile.label,
    value: profile.id,
    textValue: `${profile.label} ${profile.description} ${profile.id}`,
  }));
}
