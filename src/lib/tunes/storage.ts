import { get, set } from "idb-keyval";
import type {
  TunesPersistedState,
  TunesPlaylist,
  TunesQueueMode,
  TunesQueueState,
  TunesTrack,
} from "@/lib/tunes/types";
import { createEmptyQueueState, TUNES_DEFAULT_QUEUE_MODE } from "@/lib/tunes/types";

export const TUNES_STORAGE_KEY = "echo-mirage-tunes-v1";

function isTrack(value: unknown): value is TunesTrack {
  if (!value || typeof value !== "object") return false;
  const track = value as TunesTrack;
  return (
    typeof track.id === "string" &&
    typeof track.title === "string" &&
    (track.provider === "youtube" || track.provider === "bandcamp" || track.provider === "external") &&
    typeof track.url === "string" &&
    Array.isArray(track.tags) &&
    typeof track.playCount === "number" &&
    typeof track.skipCount === "number" &&
    typeof track.createdAt === "string" &&
    typeof track.updatedAt === "string"
  );
}

function isPlaylist(value: unknown): value is TunesPlaylist {
  if (!value || typeof value !== "object") return false;
  const playlist = value as TunesPlaylist;
  return (
    typeof playlist.id === "string" &&
    typeof playlist.name === "string" &&
    Array.isArray(playlist.trackIds) &&
    typeof playlist.createdAt === "string" &&
    typeof playlist.updatedAt === "string"
  );
}

function normalizeQueueMode(mode: unknown): TunesQueueMode {
  if (mode === "sequential" || mode === "shuffle_bag" || mode === "true_random") return mode;
  return TUNES_DEFAULT_QUEUE_MODE;
}

function normalizeQueueState(raw: unknown): TunesQueueState {
  if (!raw || typeof raw !== "object") return createEmptyQueueState();
  const queue = raw as Partial<TunesQueueState>;
  return {
    playlistId: typeof queue.playlistId === "string" ? queue.playlistId : undefined,
    currentTrackId: typeof queue.currentTrackId === "string" ? queue.currentTrackId : undefined,
    queueTrackIds: Array.isArray(queue.queueTrackIds)
      ? queue.queueTrackIds.filter((id): id is string => typeof id === "string")
      : [],
    historyTrackIds: Array.isArray(queue.historyTrackIds)
      ? queue.historyTrackIds.filter((id): id is string => typeof id === "string").slice(-200)
      : [],
    mode: normalizeQueueMode(queue.mode),
    isPlaying: Boolean(queue.isPlaying),
  };
}

export function createDefaultTunesState(): TunesPersistedState {
  const now = new Date().toISOString();
  const defaultPlaylist: TunesPlaylist = {
    id: "playlist-default",
    name: "Default",
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
  return {
    schemaVersion: 1,
    playlists: [defaultPlaylist],
    tracks: {},
    queueState: createEmptyQueueState(),
    activePlaylistId: defaultPlaylist.id,
  };
}

export function normalizeTunesState(raw: unknown): TunesPersistedState {
  const defaults = createDefaultTunesState();
  if (!raw || typeof raw !== "object") return defaults;
  const parsed = raw as Partial<TunesPersistedState>;
  if (parsed.schemaVersion !== 1) return defaults;

  const playlists = Array.isArray(parsed.playlists)
    ? parsed.playlists.filter(isPlaylist)
    : defaults.playlists;
  const tracksRaw = parsed.tracks;
  const tracks: Record<string, TunesTrack> = {};
  if (tracksRaw && typeof tracksRaw === "object" && !Array.isArray(tracksRaw)) {
    for (const [id, track] of Object.entries(tracksRaw)) {
      if (isTrack(track)) tracks[id] = track;
    }
  }

  const activePlaylistId =
    typeof parsed.activePlaylistId === "string" &&
    playlists.some((playlist) => playlist.id === parsed.activePlaylistId)
      ? parsed.activePlaylistId
      : playlists[0]?.id ?? null;

  return {
    schemaVersion: 1,
    playlists: playlists.length > 0 ? playlists : defaults.playlists,
    tracks,
    queueState: normalizeQueueState(parsed.queueState),
    activePlaylistId,
  };
}

export async function loadTunesState(): Promise<TunesPersistedState> {
  if (typeof window === "undefined") return createDefaultTunesState();
  try {
    const raw = await get(TUNES_STORAGE_KEY);
    return normalizeTunesState(raw);
  } catch {
    return createDefaultTunesState();
  }
}

export async function saveTunesState(state: TunesPersistedState): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await set(TUNES_STORAGE_KEY, state);
  } catch {
    /* ignore */
  }
}
