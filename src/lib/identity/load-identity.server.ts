import fs from "fs/promises";
import path from "path";
import { isValidIdentity, isValidPermissions, isValidVoiceProfile, getDefaultIdentity } from "./validate-identity";
import type { Identity, Permissions, VoiceProfile } from "./identity-types";

const IDENTITY_DIR = path.join(process.cwd(), ".echo-mirage");
const IDENTITY_PATH = path.join(IDENTITY_DIR, "identity.json");
const PERMISSIONS_PATH = path.join(IDENTITY_DIR, "permissions.json");
const VOICE_PROFILE_PATH = path.join(IDENTITY_DIR, "voice-profile.json");

interface IdentityBundle {
  identity: Identity | null;
  permissions: Permissions | null;
  voiceProfile: VoiceProfile | null;
}

export async function loadIdentityBundle(): Promise<IdentityBundle> {
  const result: IdentityBundle = {
    identity: null,
    permissions: null,
    voiceProfile: null,
  };

  try {
    const identityData = await fs.readFile(IDENTITY_PATH, "utf-8");
    const parsed = JSON.parse(identityData);
    if (isValidIdentity(parsed)) {
      result.identity = parsed;
    }
  } catch {
    // fail gracefully - identity remains null
  }

  try {
    const permissionsData = await fs.readFile(PERMISSIONS_PATH, "utf-8");
    const parsed = JSON.parse(permissionsData);
    if (isValidPermissions(parsed)) {
      result.permissions = parsed;
    }
  } catch {
    // fail gracefully
  }

  try {
    const voiceData = await fs.readFile(VOICE_PROFILE_PATH, "utf-8");
    const parsed = JSON.parse(voiceData);
    if (isValidVoiceProfile(parsed)) {
      result.voiceProfile = parsed;
    }
  } catch {
    // fail gracefully
  }

  return result;
}

export { getDefaultIdentity };