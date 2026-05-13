export interface Identity {
  agent_id: string;
  name: string;
  role: string;
  values: string[];
  continuity_rules: string[];
  voice_profile: string;
}

export interface Permissions {
  allowed_providers: string[];
  network_access: boolean;
  file_system_access: boolean;
  max_session_duration_minutes: number;
}

export interface VoiceProfile {
  voice_id: string;
  pitch: number;
  speed: number;
  volume: number;
}