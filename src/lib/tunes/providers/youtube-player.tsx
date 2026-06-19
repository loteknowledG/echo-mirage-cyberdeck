"use client";

import { useEffect, useRef, useState } from "react";

type YouTubePlayerState = {
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
};

type YouTubePlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
};

type YouTubePlayerConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: () => void;
      onStateChange?: (event: { data: number }) => void;
      onError?: (event: { data: number }) => void;
    };
  },
) => YouTubePlayerInstance;

declare global {
  interface Window {
    YT?: {
      Player: YouTubePlayerConstructor;
      PlayerState: YouTubePlayerState;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  youtubeApiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const poll = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(poll);
          resolve();
        }
      }, 50);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return youtubeApiPromise;
}

export type TunesYouTubePlayerProps = {
  videoId: string;
  isPlaying: boolean;
  volume?: number;
  onEnded: () => void;
  onError: (message: string) => void;
  onReady?: () => void;
};

export function TunesYouTubePlayer({
  videoId,
  isPlaying,
  volume = 70,
  onEnded,
  onError,
  onReady,
}: TunesYouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || !videoId) return;

    void loadYouTubeIframeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return;
      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            onReady?.();
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED) onEnded();
          },
          onError: (event) => onError(`YouTube player error (${event.data})`),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      setReady(false);
    };
  }, [videoId, onEnded, onError, onReady]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    player.setVolume(Math.max(0, Math.min(100, volume)));
    if (isPlaying) player.playVideo();
    else player.pauseVideo();
  }, [isPlaying, ready, volume]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-sm border border-[#2a2a2a] bg-black">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
