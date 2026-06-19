import { nanoid } from "nanoid";
import { detectTunesTrackInput } from "@/lib/tunes/detect-provider";
import { emitTunesEvent } from "@/lib/tunes/events";
import {
  advanceQueueAfterTrack,
  buildQueueForMode,
  pickNextTrackId,
  pickPreviousTrackId,
  skipCurrentTrack,
} from "@/lib/tunes/queue-engine";
import {
  createDefaultTunesState,
  loadTunesState,
  saveTunesState,
} from "@/lib/tunes/storage";
import type {
  TunesPersistedState,
  TunesPlaylist,
  TunesProviderError,
  TunesQueueMode,
  TunesQueueState,
  TunesTrack,
} from "@/lib/tunes/types";
import { createEmptyQueueState, TUNES_DEFAULT_QUEUE_MODE } from "@/lib/tunes/types";

type Listener = () => void;

export type TunesEngineSnapshot = TunesPersistedState & {
  providerErrors: TunesProviderError[];
};

function nowIso() {
  return new Date().toISOString();
}

export class TunesEngine {
  private state: TunesEngineSnapshot = {
    ...createDefaultTunesState(),
    providerErrors: [],
  };

  private hydrated = false;
  private persistTimer: number | null = null;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): TunesEngineSnapshot {
    return this.state;
  }

  isHydrated(): boolean {
    return this.hydrated;
  }

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const loaded = await loadTunesState();
    this.state = { ...loaded, providerErrors: [] };
    this.hydrated = true;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private schedulePersist(): void {
    if (typeof window === "undefined" || !this.hydrated) return;
    if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      const { providerErrors: _ignored, ...persisted } = this.state;
      void saveTunesState(persisted);
    }, 250);
  }

  private setState(next: TunesEngineSnapshot): void {
    this.state = next;
    this.notify();
    this.schedulePersist();
  }

  private activePlaylist(): TunesPlaylist | undefined {
    const id = this.state.activePlaylistId;
    return this.state.playlists.find((playlist) => playlist.id === id);
  }

  private playlistTrackIds(playlistId?: string): string[] {
    const playlist = this.state.playlists.find((entry) => entry.id === playlistId);
    if (!playlist) return [];
    return playlist.trackIds.filter((id) => Boolean(this.state.tracks[id]));
  }

  private pushProviderError(error: Omit<TunesProviderError, "at">): void {
    const entry: TunesProviderError = { ...error, at: nowIso() };
    this.setState({
      ...this.state,
      providerErrors: [entry, ...this.state.providerErrors].slice(0, 20),
    });
    emitTunesEvent("provider_error", { ...error });
  }

  createPlaylist(name: string, description?: string): TunesPlaylist {
    const trimmed = name.trim() || "Untitled";
    const timestamp = nowIso();
    const playlist: TunesPlaylist = {
      id: `playlist-${nanoid(8)}`,
      name: trimmed,
      description: description?.trim() || undefined,
      trackIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.setState({
      ...this.state,
      playlists: [...this.state.playlists, playlist],
      activePlaylistId: playlist.id,
    });
    emitTunesEvent("playlist_created", { playlistId: playlist.id, name: trimmed });
    return playlist;
  }

  selectPlaylist(id: string): boolean {
    const playlist = this.state.playlists.find((entry) => entry.id === id);
    if (!playlist) return false;
    const trackIds = this.playlistTrackIds(id);
    const queueState: TunesQueueState = {
      ...createEmptyQueueState(this.state.queueState.mode),
      playlistId: id,
      queueTrackIds: buildQueueForMode(trackIds, this.state.queueState.mode),
    };
    this.setState({
      ...this.state,
      activePlaylistId: id,
      queueState,
    });
    emitTunesEvent("playlist_selected", { playlistId: id });
    return true;
  }

  addTrack(url: string, playlistId?: string): TunesTrack | null {
    const targetPlaylistId = playlistId ?? this.state.activePlaylistId;
    if (!targetPlaylistId) return null;
    const playlistIndex = this.state.playlists.findIndex((entry) => entry.id === targetPlaylistId);
    if (playlistIndex < 0) return null;

    const detected = detectTunesTrackInput(url);
    if (!detected.url) return null;

    const timestamp = nowIso();
    const track: TunesTrack = {
      id: `track-${nanoid(10)}`,
      title: detected.title,
      provider: detected.provider,
      url: detected.url,
      embedUrl: detected.embedUrl,
      providerId: detected.providerId,
      tags: [],
      playCount: 0,
      skipCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const playlists = [...this.state.playlists];
    const playlist = { ...playlists[playlistIndex] };
    playlist.trackIds = [...playlist.trackIds, track.id];
    playlist.updatedAt = timestamp;
    playlists[playlistIndex] = playlist;

    this.setState({
      ...this.state,
      playlists,
      tracks: { ...this.state.tracks, [track.id]: track },
    });
    emitTunesEvent("track_added", {
      trackId: track.id,
      playlistId: targetPlaylistId,
      provider: track.provider,
    });
    return track;
  }

  setQueueMode(mode: TunesQueueMode): void {
    const playlistId = this.state.queueState.playlistId ?? this.state.activePlaylistId ?? undefined;
    const trackIds = this.playlistTrackIds(playlistId);
    const queueState: TunesQueueState = {
      ...this.state.queueState,
      mode,
      queueTrackIds: buildQueueForMode(trackIds, mode, this.state.queueState.currentTrackId),
    };
    this.setState({ ...this.state, queueState });
  }

  playTrack(trackId: string): boolean {
    const track = this.state.tracks[trackId];
    if (!track) return false;

    const playlist = this.activePlaylist();
    const playlistId = playlist?.id;
    const queueState: TunesQueueState = {
      ...this.state.queueState,
      playlistId,
      currentTrackId: trackId,
      isPlaying: true,
    };

    const timestamp = nowIso();
    const updatedTrack: TunesTrack = {
      ...track,
      playCount: track.playCount + 1,
      lastPlayedAt: timestamp,
      updatedAt: timestamp,
    };

    this.setState({
      ...this.state,
      tracks: { ...this.state.tracks, [trackId]: updatedTrack },
      queueState,
    });
    emitTunesEvent("track_started", { trackId, provider: track.provider });
    return true;
  }

  playPlaylist(playlistId?: string): boolean {
    const id = playlistId ?? this.state.activePlaylistId;
    if (!id) return false;
    if (!this.selectPlaylist(id)) return false;
    const trackIds = this.playlistTrackIds(id);
    if (trackIds.length === 0) return false;
    const { nextTrackId } = pickNextTrackId(this.state.queueState, trackIds);
    if (!nextTrackId) return false;
    return this.playTrack(nextTrackId);
  }

  pauseTrack(): void {
    if (!this.state.queueState.isPlaying) return;
    this.setState({
      ...this.state,
      queueState: { ...this.state.queueState, isPlaying: false },
    });
    emitTunesEvent("track_paused", { trackId: this.state.queueState.currentTrackId });
  }

  resumeTrack(): void {
    if (!this.state.queueState.currentTrackId) {
      this.playPlaylist();
      return;
    }
    this.setState({
      ...this.state,
      queueState: { ...this.state.queueState, isPlaying: true },
    });
    emitTunesEvent("track_started", { trackId: this.state.queueState.currentTrackId });
  }

  nextTrack(): boolean {
    const playlistId = this.state.queueState.playlistId ?? this.state.activePlaylistId ?? undefined;
    const trackIds = this.playlistTrackIds(playlistId);
    const queueState = skipCurrentTrack(this.state.queueState, trackIds);
    const nextId = queueState.currentTrackId;
    this.setState({ ...this.state, queueState });
    emitTunesEvent("queue_advanced", { trackId: nextId, reason: "next" });
    if (!nextId) {
      this.setState({
        ...this.state,
        queueState: { ...queueState, isPlaying: false },
      });
      return false;
    }
    return this.playTrack(nextId);
  }

  previousTrack(): boolean {
    const previousId = pickPreviousTrackId(this.state.queueState);
    if (!previousId) return false;
    return this.playTrack(previousId);
  }

  skipTrack(): boolean {
    const currentId = this.state.queueState.currentTrackId;
    if (currentId) {
      const track = this.state.tracks[currentId];
      if (track) {
        this.setState({
          ...this.state,
          tracks: {
            ...this.state.tracks,
            [currentId]: { ...track, skipCount: track.skipCount + 1, updatedAt: nowIso() },
          },
        });
      }
      emitTunesEvent("track_skipped", { trackId: currentId });
    }
    return this.nextTrack();
  }

  handleTrackEnded(): void {
    const currentId = this.state.queueState.currentTrackId;
    if (!currentId) return;
    emitTunesEvent("track_ended", { trackId: currentId });
    const playlistId = this.state.queueState.playlistId ?? this.state.activePlaylistId ?? undefined;
    const trackIds = this.playlistTrackIds(playlistId);
    const queueState = advanceQueueAfterTrack(this.state.queueState, currentId, trackIds);
    this.setState({ ...this.state, queueState });
    emitTunesEvent("queue_advanced", { trackId: queueState.currentTrackId, reason: "ended" });
    if (queueState.currentTrackId && queueState.isPlaying) {
      this.playTrack(queueState.currentTrackId);
    }
  }

  reportProviderError(message: string, provider: TunesTrack["provider"], trackId?: string): void {
    this.pushProviderError({ message, provider, trackId });
  }

  clearProviderErrors(): void {
    this.setState({ ...this.state, providerErrors: [] });
  }
}

let tunesEngineSingleton: TunesEngine | null = null;

export function getTunesEngine(): TunesEngine {
  if (typeof window === "undefined") {
    tunesEngineSingleton ??= new TunesEngine();
    return tunesEngineSingleton;
  }
  if (!window.__echoMirageTunesEngine) {
    window.__echoMirageTunesEngine = new TunesEngine();
    window.__echoMirageTunes = tunesCommands;
  }
  return window.__echoMirageTunesEngine;
}

/** MUTHUR-ready command surface */
export const tunesCommands = {
  createPlaylist: (name: string) => getTunesEngine().createPlaylist(name),
  selectPlaylist: (id: string) => getTunesEngine().selectPlaylist(id),
  addTrack: (url: string, playlistId?: string) => getTunesEngine().addTrack(url, playlistId),
  playTrack: (trackId: string) => getTunesEngine().playTrack(trackId),
  playPlaylist: (playlistId?: string) => getTunesEngine().playPlaylist(playlistId),
  nextTrack: () => getTunesEngine().nextTrack(),
  previousTrack: () => getTunesEngine().previousTrack(),
  skipTrack: () => getTunesEngine().skipTrack(),
  setQueueMode: (mode: TunesQueueMode) => getTunesEngine().setQueueMode(mode),
  pauseTrack: () => getTunesEngine().pauseTrack(),
  resumeTrack: () => getTunesEngine().resumeTrack(),
};

declare global {
  interface Window {
    __echoMirageTunesEngine?: TunesEngine;
    __echoMirageTunes?: typeof tunesCommands;
  }
}
