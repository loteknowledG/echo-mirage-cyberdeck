export type TunesProvider = "youtube" | "bandcamp" | "external";

export type TunesQueueMode = "sequential" | "shuffle_bag" | "true_random";

export type TunesTrack = {
  id: string;
  title: string;
  provider: TunesProvider;
  url: string;
  embedUrl?: string;
  providerId?: string;
  tags: string[];
  notes?: string;
  playCount: number;
  skipCount: number;
  lastPlayedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TunesPlaylist = {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type TunesQueueState = {
  playlistId?: string;
  currentTrackId?: string;
  queueTrackIds: string[];
  historyTrackIds: string[];
  mode: TunesQueueMode;
  isPlaying: boolean;
};

export type TunesProviderError = {
  provider: TunesProvider;
  message: string;
  trackId?: string;
  at: string;
};

export type MediaProtectionStatus =
  | "unavailable"
  | "disabled"
  | "initializing"
  | "enabled"
  | "failed";

export type TunesPersistedState = {
  schemaVersion: 1;
  playlists: TunesPlaylist[];
  tracks: Record<string, TunesTrack>;
  queueState: TunesQueueState;
  activePlaylistId: string | null;
};

export type TunesEventType =
  | "playlist_created"
  | "playlist_selected"
  | "track_added"
  | "track_started"
  | "track_paused"
  | "track_ended"
  | "track_skipped"
  | "queue_advanced"
  | "provider_error";

export type TunesEvent = {
  type: TunesEventType;
  at: string;
  payload?: Record<string, unknown>;
};

export const TUNES_DEFAULT_QUEUE_MODE: TunesQueueMode = "shuffle_bag";

export function createEmptyQueueState(mode: TunesQueueMode = TUNES_DEFAULT_QUEUE_MODE): TunesQueueState {
  return {
    queueTrackIds: [],
    historyTrackIds: [],
    mode,
    isPlaying: false,
  };
}
