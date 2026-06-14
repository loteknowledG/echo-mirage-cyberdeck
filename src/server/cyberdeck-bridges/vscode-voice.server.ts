import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { DEFAULT_VSCODE_TTS_PROFILE_ID } from "@/lib/cursorTtsProfiles";
import { resolveVoiceProfile } from "@/lib/voice-profiles";

export type VscodeVoiceBridgeState = {
  muted: boolean;
  profile: string;
  bridge: boolean;
  audioUrl?: string | null;
  skipped?: string;
};

function hooksDir(rootDir = process.cwd()) {
  return path.join(rootDir, ".vscode", "hooks");
}

function mutedFile(rootDir = process.cwd()) {
  return path.join(hooksDir(rootDir), "vscode-voice.muted");
}

function voiceFile(rootDir = process.cwd()) {
  return path.join(hooksDir(rootDir), "vscode-tts-voice.txt");
}

export function readVscodeVoiceMuted(rootDir = process.cwd()): boolean {
  try {
    if (!fs.existsSync(mutedFile(rootDir))) return false;
    return fs.readFileSync(mutedFile(rootDir), "utf8").trim() === "1";
  } catch {
    return false;
  }
}

export function writeVscodeVoiceMuted(muted: boolean, rootDir = process.cwd()): void {
  const file = mutedFile(rootDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (muted) {
    fs.writeFileSync(file, "1\n", "utf8");
    return;
  }
  try {
    fs.unlinkSync(file);
  } catch {
    /* absent */
  }
}

export function readVscodeVoiceProfile(rootDir = process.cwd()): string {
  try {
    if (!fs.existsSync(voiceFile(rootDir))) return DEFAULT_VSCODE_TTS_PROFILE_ID;
    const raw = fs.readFileSync(voiceFile(rootDir), "utf8").trim();
    return raw || DEFAULT_VSCODE_TTS_PROFILE_ID;
  } catch {
    return DEFAULT_VSCODE_TTS_PROFILE_ID;
  }
}

export function writeVscodeVoiceProfile(id: string, rootDir = process.cwd()): void {
  const next = id.trim() || DEFAULT_VSCODE_TTS_PROFILE_ID;
  const file = voiceFile(rootDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${next}\n`, "utf8");
}

export function readVscodeVoiceBridgeState(rootDir = process.cwd()): VscodeVoiceBridgeState {
  return {
    muted: readVscodeVoiceMuted(rootDir),
    profile: readVscodeVoiceProfile(rootDir),
    bridge: true,
  };
}

async function requestBrowserTtsAudioUrl(text: string, voice: string): Promise<string | null> {
  const origin =
    process.env.CYBERDECK_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://127.0.0.1:3050";
  const response = await fetch(`${origin.replace(/\/+$/, "")}/api/browser-tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, rate: 0, pitch: 0 }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { audio_url?: string; audio_path?: string };
  const audioPath = String(json.audio_url || json.audio_path || "").trim();
  if (!audioPath) return null;
  return new URL(audioPath, `${origin.replace(/\/+$/, "")}/`).toString();
}

async function readLastVscodeSentence(rootDir = process.cwd()): Promise<string> {
  const script = path.join(rootDir, "tools", "vscode_last_reply.ts");
  if (!fs.existsSync(script)) return "";
  try {
    return execSync(`npx tsx "${script}" --last-sentence`, {
      cwd: rootDir,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  } catch {
    return "";
  }
}

export async function patchVscodeVoiceBridgeState(
  patch: { muted?: boolean; profile?: string; speak?: string },
  rootDir = process.cwd(),
): Promise<VscodeVoiceBridgeState> {
  if (typeof patch.muted === "boolean") writeVscodeVoiceMuted(patch.muted, rootDir);
  if (typeof patch.profile === "string") writeVscodeVoiceProfile(patch.profile, rootDir);

  const profileId = readVscodeVoiceProfile(rootDir);
  let text = typeof patch.speak === "string" ? patch.speak.trim() : "";
  if (!text) {
    text = await readLastVscodeSentence(rootDir);
  }
  if (!text) {
    return { ...readVscodeVoiceBridgeState(rootDir), audioUrl: null, skipped: "no_message_found" };
  }

  const profile = resolveVoiceProfile(profileId);
  const voice = profile?.browserVoice || "en-US-JennyNeural";
  const audioUrl = await requestBrowserTtsAudioUrl(text, voice);

  return {
    ...readVscodeVoiceBridgeState(rootDir),
    audioUrl,
  };
}
