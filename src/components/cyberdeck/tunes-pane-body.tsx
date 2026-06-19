"use client";

import { useCallback, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { providerBadge } from "@/lib/tunes/detect-provider";
import { mediaProtectionLabel, useMediaProtectionStatus } from "@/lib/tunes/media-protection";
import { TunesPlayerHost } from "@/lib/tunes/providers/player-host";
import type { TunesQueueMode } from "@/lib/tunes/types";
import { useTunesEngine } from "@/lib/tunes/use-tunes-engine";
import { cn } from "@/lib/utils";

const QUEUE_MODES: { id: TunesQueueMode; label: string }[] = [
  { id: "shuffle_bag", label: "SHUFFLE BAG" },
  { id: "true_random", label: "TRUE RANDOM" },
  { id: "sequential", label: "SEQUENTIAL" },
];

export function CyberdeckTunesPaneBody() {
  const { snapshot, engine, hydrated } = useTunesEngine();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [trackUrlInput, setTrackUrlInput] = useState("");
  const mediaProtection = useMediaProtectionStatus();

  const activePlaylist = snapshot.playlists.find((entry) => entry.id === snapshot.activePlaylistId);
  const currentTrack = snapshot.queueState.currentTrackId
    ? snapshot.tracks[snapshot.queueState.currentTrackId]
    : null;

  const handleCreatePlaylist = useCallback(() => {
    engine.createPlaylist(newPlaylistName);
    setNewPlaylistName("");
  }, [engine, newPlaylistName]);

  const handleAddTrack = useCallback(() => {
    const added = engine.addTrack(trackUrlInput);
    if (!added) return;
    setTrackUrlInput("");
  }, [engine, trackUrlInput]);

  const handleProviderError = useCallback(
    (message: string) => {
      if (!currentTrack) return;
      engine.reportProviderError(message, currentTrack.provider, currentTrack.id);
    },
    [currentTrack, engine],
  );

  const handleEnded = useCallback(() => {
    engine.handleTrackEnded();
  }, [engine]);

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(57,255,136,0.12)" }}>
                TUNES
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                PLAYLIST MANAGER // QUEUE ENGINE // MIXED PROVIDERS
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <div className="flex flex-col items-end gap-1">
              <CyberdeckPaneHeaderValue>{hydrated ? "READY" : "LOADING"}</CyberdeckPaneHeaderValue>
              <span className="font-mono text-[7px] tracking-[0.08em] text-[#6a6a6a]">
                {mediaProtectionLabel(mediaProtection)}
              </span>
            </div>
          }
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="flex min-h-0 flex-col gap-3">
            <div className="rounded-sm border border-[#1c1c1c] p-2">
              <label className="mb-1 block font-mono text-[8px] tracking-[0.1em] text-[#8a8a8a]">
                PLAYLIST
              </label>
              <select
                value={snapshot.activePlaylistId ?? ""}
                onChange={(event) => engine.selectPlaylist(event.target.value)}
                className="mb-2 w-full rounded-sm border border-[#2a2a2a] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
              >
                {snapshot.playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name} ({playlist.trackIds.length})
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newPlaylistName}
                  onChange={(event) => setNewPlaylistName(event.target.value)}
                  placeholder="New playlist name"
                  className="min-w-0 flex-1 rounded-sm border border-[#2a2a2a] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
                />
                <button
                  type="button"
                  onClick={handleCreatePlaylist}
                  className="rounded-sm border border-emerald-500/30 px-2 py-1 font-mono text-[8px] tracking-[0.1em] text-emerald-300 hover:bg-emerald-500/10"
                >
                  CREATE
                </button>
              </div>
            </div>

            <div className="rounded-sm border border-[#1c1c1c] p-2">
              <label className="mb-1 block font-mono text-[8px] tracking-[0.1em] text-[#8a8a8a]">
                ADD TRACK BY URL
              </label>
              <div className="flex gap-2">
                <input
                  value={trackUrlInput}
                  onChange={(event) => setTrackUrlInput(event.target.value)}
                  placeholder="YouTube, Bandcamp URL, or embed iframe"
                  className="min-w-0 flex-1 rounded-sm border border-[#2a2a2a] bg-black px-2 py-1 font-mono text-[10px] text-[#d0d0d0]"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAddTrack();
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTrack}
                  className="rounded-sm border border-[#444] px-2 py-1 font-mono text-[8px] tracking-[0.1em] text-[#c0c0c0] hover:bg-[#141414]"
                >
                  ADD
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-[#1c1c1c]">
              <div className="sticky top-0 border-b border-[#1c1c1c] bg-black px-2 py-1 font-mono text-[8px] tracking-[0.1em] text-[#8a8a8a]">
                TRACKS — {activePlaylist?.name ?? "NONE"}
              </div>
              <ul className="divide-y divide-[#141414]">
                {(activePlaylist?.trackIds ?? []).map((trackId) => {
                  const track = snapshot.tracks[trackId];
                  if (!track) return null;
                  const isCurrent = snapshot.queueState.currentTrackId === trackId;
                  return (
                    <li key={trackId}>
                      <button
                        type="button"
                        onClick={() => engine.playTrack(trackId)}
                        className={cn(
                          "flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-[#0d0d0d]",
                          isCurrent && "bg-emerald-500/10",
                        )}
                      >
                        <span className="shrink-0 rounded-sm border border-[#333] px-1 font-mono text-[7px] text-[#9a9a9a]">
                          {providerBadge(track.provider)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#d0d0d0]">
                          {track.title}
                        </span>
                        <span className="font-mono text-[8px] text-[#666]">{track.playCount}▶</span>
                      </button>
                    </li>
                  );
                })}
                {(activePlaylist?.trackIds.length ?? 0) === 0 ? (
                  <li className="px-2 py-4 font-mono text-[9px] text-[#666]">NO TRACKS YET</li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <TunesPlayerHost
              track={currentTrack}
              isPlaying={snapshot.queueState.isPlaying}
              onEnded={handleEnded}
              onProviderError={handleProviderError}
            />

            <div className="rounded-sm border border-[#1c1c1c] p-2">
              <p className="mb-2 font-mono text-[8px] tracking-[0.1em] text-[#8a8a8a]">NOW PLAYING</p>
              <p className="truncate font-mono text-[11px] text-[#e0e0e0]">
                {currentTrack?.title ?? "—"}
              </p>
              <p className="mt-1 font-mono text-[8px] text-[#666]">
                {currentTrack ? providerBadge(currentTrack.provider) : "—"} //
                {snapshot.queueState.isPlaying ? " PLAYING" : " PAUSED"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  snapshot.queueState.isPlaying ? engine.pauseTrack() : engine.resumeTrack()
                }
                className="rounded-sm border border-[#444] px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-[#c0c0c0] hover:bg-[#141414]"
              >
                {snapshot.queueState.isPlaying ? "PAUSE" : "PLAY"}
              </button>
              <button
                type="button"
                onClick={() => engine.playPlaylist()}
                className="rounded-sm border border-emerald-500/30 px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-emerald-300 hover:bg-emerald-500/10"
              >
                PLAY PLAYLIST
              </button>
              <button
                type="button"
                onClick={() => engine.nextTrack()}
                className="rounded-sm border border-[#444] px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-[#c0c0c0] hover:bg-[#141414]"
              >
                NEXT
              </button>
              <button
                type="button"
                onClick={() => engine.skipTrack()}
                className="rounded-sm border border-[#444] px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-[#c0c0c0] hover:bg-[#141414]"
              >
                SKIP
              </button>
              <button
                type="button"
                onClick={() => engine.previousTrack()}
                className="rounded-sm border border-[#444] px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-[#c0c0c0] hover:bg-[#141414]"
              >
                PREV
              </button>
            </div>

            <div className="rounded-sm border border-[#1c1c1c] p-2">
              <p className="mb-2 font-mono text-[8px] tracking-[0.1em] text-[#8a8a8a]">QUEUE MODE</p>
              <div className="flex flex-wrap gap-1">
                {QUEUE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => engine.setQueueMode(mode.id)}
                    className={cn(
                      "rounded-sm px-2 py-1 font-mono text-[8px] tracking-[0.08em]",
                      snapshot.queueState.mode === mode.id
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "text-[#8a8a8a] hover:text-[#c0c0c0]",
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 font-mono text-[8px] text-[#666]">
                QUEUE: {snapshot.queueState.queueTrackIds.length} // HISTORY:{" "}
                {snapshot.queueState.historyTrackIds.length}
              </p>
            </div>

            {snapshot.providerErrors.length > 0 ? (
              <div className="rounded-sm border border-amber-500/30 bg-amber-500/5 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-mono text-[8px] tracking-[0.1em] text-amber-300">PROVIDER ERRORS</p>
                  <button
                    type="button"
                    onClick={() => engine.clearProviderErrors()}
                    className="font-mono text-[7px] text-[#888] hover:text-[#ccc]"
                  >
                    CLEAR
                  </button>
                </div>
                <ul className="space-y-1">
                  {snapshot.providerErrors.slice(0, 5).map((error) => (
                    <li key={error.at + error.message} className="font-mono text-[8px] text-amber-200/80">
                      [{providerBadge(error.provider)}] {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
