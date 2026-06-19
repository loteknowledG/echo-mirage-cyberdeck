"use client";

import type { TunesTrack } from "@/lib/tunes/types";
import { TunesBandcampEmbed } from "@/lib/tunes/providers/bandcamp-embed";
import { TunesExternalTrack } from "@/lib/tunes/providers/external-track";
import { TunesYouTubePlayer } from "@/lib/tunes/providers/youtube-player";

export type TunesPlayerHostProps = {
  track: TunesTrack | null;
  isPlaying: boolean;
  onEnded: () => void;
  onProviderError: (message: string) => void;
};

export function TunesPlayerHost({ track, isPlaying, onEnded, onProviderError }: TunesPlayerHostProps) {
  if (!track) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-sm border border-dashed border-[#2a2a2a] bg-black p-4 font-mono text-[9px] tracking-[0.1em] text-[#6a6a6a]">
        NO TRACK SELECTED
      </div>
    );
  }

  switch (track.provider) {
    case "youtube":
      if (!track.providerId) {
        return (
          <div className="rounded-sm border border-amber-500/30 p-3 font-mono text-[9px] text-amber-200">
            Missing YouTube video id
          </div>
        );
      }
      return (
        <TunesYouTubePlayer
          videoId={track.providerId}
          isPlaying={isPlaying}
          onEnded={onEnded}
          onError={onProviderError}
        />
      );
    case "bandcamp":
      return (
        <TunesBandcampEmbed embedUrl={track.embedUrl} pageUrl={track.url} title={track.title} />
      );
    case "external":
      return <TunesExternalTrack url={track.url} title={track.title} />;
    default: {
      const _exhaustive: never = track.provider;
      return _exhaustive;
    }
  }
}
