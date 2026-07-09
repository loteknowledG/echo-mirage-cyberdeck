// SERVER ONLY — in-flight missions from capture desk → solver desk.

import fs from "node:fs/promises";
import path from "node:path";
import type { SurveyMissionKind } from "@/lib/cyberdeck/powerfist-mission.types";

export type StoredPowerfistMission = {
  missionId: string;
  kind: SurveyMissionKind;
  prompt: string;
  pngPath: string;
  createdAt: string;
};

const missions = new Map<string, StoredPowerfistMission>();

function missionsDir(): string {
  return path.join(process.cwd(), ".muthur", "powerfist-missions");
}

export async function storePowerfistMission(input: {
  missionId: string;
  kind: SurveyMissionKind;
  prompt: string;
  pngBase64: string;
}): Promise<StoredPowerfistMission> {
  const dir = missionsDir();
  await fs.mkdir(dir, { recursive: true });
  const pngPath = path.join(dir, `${input.missionId}.png`);
  await fs.writeFile(pngPath, Buffer.from(input.pngBase64, "base64"));

  const record: StoredPowerfistMission = {
    missionId: input.missionId,
    kind: input.kind,
    prompt: input.prompt,
    pngPath,
    createdAt: new Date().toISOString(),
  };
  missions.set(input.missionId, record);
  return record;
}

export async function readPowerfistMissionPng(
  missionId: string,
): Promise<{ ok: true; data: Buffer } | { ok: false; error: string }> {
  const cached = missions.get(missionId);
  const pngPath = cached?.pngPath ?? path.join(missionsDir(), `${missionId}.png`);
  try {
    const data = await fs.readFile(pngPath);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Mission image not found." };
  }
}

export function getStoredPowerfistMission(missionId: string): StoredPowerfistMission | null {
  return missions.get(missionId) ?? null;
}
