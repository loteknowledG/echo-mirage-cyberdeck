import fs from "node:fs";
import path from "node:path";

import { isValidCursorTtsProfileId } from "@/lib/cursorTtsProfileId";
import {
  clampCursorTtsVolumeUi,
  CURSOR_TTS_VOLUME_UI_DEFAULT,
} from "@/lib/cursorTtsVolume";
import { DEFAULT_CURSOR_TTS_PROFILE_ID } from "@/lib/cursorTtsProfiles";

export type MechanicusCursorBridgeState = {
  muted: boolean;
  profile: string;
  volume: number;
  bridge: boolean;
};

function hooksDir(rootDir = process.cwd()) {
  return path.join(rootDir, ".cursor", "hooks");
}

function mutedFile(rootDir = process.cwd()) {
  return path.join(hooksDir(rootDir), "mechanicus-cursor.muted");
}

function voiceFile(rootDir = process.cwd()) {
  return path.join(hooksDir(rootDir), "cursor-tts-voice.txt");
}

function volumeFile(rootDir = process.cwd()) {
  return path.join(hooksDir(rootDir), "cursor-tts-volume.txt");
}

export function readMechanicusCursorMuted(rootDir = process.cwd()): boolean {
  try {
    if (!fs.existsSync(mutedFile(rootDir))) return false;
    return fs.readFileSync(mutedFile(rootDir), "utf8").trim() === "1";
  } catch {
    return false;
  }
}

export function writeMechanicusCursorMuted(muted: boolean, rootDir = process.cwd()): void {
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

export function readMechanicusCursorProfile(rootDir = process.cwd()): string {
  try {
    if (!fs.existsSync(voiceFile(rootDir))) return DEFAULT_CURSOR_TTS_PROFILE_ID;
    const raw = fs.readFileSync(voiceFile(rootDir), "utf8").trim();
    if (isValidCursorTtsProfileId(raw)) return raw;
  } catch {
    /* fall through */
  }
  return DEFAULT_CURSOR_TTS_PROFILE_ID;
}

export function writeMechanicusCursorProfile(id: string, rootDir = process.cwd()): void {
  const next = isValidCursorTtsProfileId(id) ? id.trim() : DEFAULT_CURSOR_TTS_PROFILE_ID;
  const file = voiceFile(rootDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${next}\n`, "utf8");
}

export function readMechanicusCursorVolume(rootDir = process.cwd()): number {
  try {
    if (!fs.existsSync(volumeFile(rootDir))) return CURSOR_TTS_VOLUME_UI_DEFAULT;
    const raw = fs.readFileSync(volumeFile(rootDir), "utf8").trim();
    const n = Number.parseInt(raw, 10);
    return clampCursorTtsVolumeUi(n);
  } catch {
    return CURSOR_TTS_VOLUME_UI_DEFAULT;
  }
}

export function writeMechanicusCursorVolume(n: number, rootDir = process.cwd()): void {
  const next = clampCursorTtsVolumeUi(n);
  const file = volumeFile(rootDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${next}\n`, "utf8");
}

export function readMechanicusCursorBridgeState(rootDir = process.cwd()): MechanicusCursorBridgeState {
  return {
    muted: readMechanicusCursorMuted(rootDir),
    profile: readMechanicusCursorProfile(rootDir),
    volume: readMechanicusCursorVolume(rootDir),
    bridge: true,
  };
}

export function patchMechanicusCursorBridgeState(
  patch: { muted?: boolean; profile?: string; volume?: number },
  rootDir = process.cwd(),
): MechanicusCursorBridgeState {
  if (typeof patch.muted === "boolean") writeMechanicusCursorMuted(patch.muted, rootDir);
  if (typeof patch.profile === "string") writeMechanicusCursorProfile(patch.profile, rootDir);
  if (typeof patch.volume === "number" && Number.isFinite(patch.volume)) {
    writeMechanicusCursorVolume(patch.volume, rootDir);
  }
  return readMechanicusCursorBridgeState(rootDir);
}
