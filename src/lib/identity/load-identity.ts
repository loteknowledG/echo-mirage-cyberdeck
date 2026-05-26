import { isValidIdentity, isValidPermissions, isValidVoiceProfile, getDefaultIdentity } from "./validate-identity";
import type { Identity, Permissions, VoiceProfile } from "./identity-types";

interface IdentityBundle {
  identity: Identity | null;
  permissions: Permissions | null;
  voiceProfile: VoiceProfile | null;
}

let identityLoadPromise: Promise<IdentityBundle> | null = null;

async function fetchIdentityBundle(): Promise<IdentityBundle> {
  const result: IdentityBundle = {
    identity: null,
    permissions: null,
    voiceProfile: null,
  };

  try {
    const res = await fetch("/api/identity", { cache: "no-store" });
    if (res.ok) {
      const bundle = await res.json();
      if (isValidIdentity(bundle.identity)) {
        result.identity = bundle.identity;
      }
      if (isValidPermissions(bundle.permissions)) {
        result.permissions = bundle.permissions;
      }
      if (isValidVoiceProfile(bundle.voiceProfile)) {
        result.voiceProfile = bundle.voiceProfile;
      }
    }
  } catch {
    // fail gracefully - identity remains null
  }

  return result;
}

export async function loadIdentityBundle(): Promise<IdentityBundle> {
  if (!identityLoadPromise) {
    identityLoadPromise = fetchIdentityBundle();
  }
  return identityLoadPromise;
}

export { getDefaultIdentity };