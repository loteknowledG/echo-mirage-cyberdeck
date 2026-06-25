import fs from "node:fs";
import path from "node:path";

const DEFAULT_SAMUS_ROOT = "C:\\dev\\samus-manus";

/** Resolved samus-manus repo root (skills live under skills/hands-eyes). */
export function getSamusManusRoot(): string {
  const raw = process.env.SAMUS_MANUS_ROOT?.trim();
  return raw || DEFAULT_SAMUS_ROOT;
}

export function getHandsEyesSkillDir(): string {
  return path.join(getSamusManusRoot(), "skills", "hands-eyes");
}

export function getHandsPyPath(): string {
  return path.join(getHandsEyesSkillDir(), "hands.py");
}

export function resolveSamusPython(): string {
  const raw = process.env.SAMUS_PYTHON?.trim();
  return raw || "python";
}

/** Local Windows + hands.py present; opt out with SAMUS_HANDS_EYES=0. */
export function isSamusHandsEyesEnabled(): boolean {
  const raw = process.env.SAMUS_HANDS_EYES?.trim().toLowerCase();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  if (process.platform !== "win32") return false;
  try {
    return fs.existsSync(getHandsPyPath());
  } catch {
    return false;
  }
}
