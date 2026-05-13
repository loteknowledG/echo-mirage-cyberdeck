import type { Identity, Permissions, VoiceProfile } from "./identity-types";

export function isValidIdentity(obj: unknown): obj is Identity {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.agent_id === "string" &&
    typeof o.name === "string" &&
    typeof o.role === "string" &&
    Array.isArray(o.values) &&
    Array.isArray(o.continuity_rules) &&
    typeof o.voice_profile === "string"
  );
}

export function isValidPermissions(obj: unknown): obj is Permissions {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    Array.isArray(o.allowed_providers) &&
    typeof o.network_access === "boolean" &&
    typeof o.file_system_access === "boolean" &&
    typeof o.max_session_duration_minutes === "number"
  );
}

export function isValidVoiceProfile(obj: unknown): obj is VoiceProfile {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.voice_id === "string" &&
    typeof o.pitch === "number" &&
    typeof o.speed === "number" &&
    typeof o.volume === "number"
  );
}

export function getDefaultIdentity(): Identity {
  return {
    agent_id: "anonymous",
    name: "Anonymous Operator",
    role: "unregistered user",
    values: ["truthful", "helpful"],
    continuity_rules: ["default identity applied"],
    voice_profile: "muthur",
  };
}