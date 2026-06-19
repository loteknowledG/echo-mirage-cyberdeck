import type { TunesQueueMode, TunesQueueState } from "@/lib/tunes/types";
import { TUNES_DEFAULT_QUEUE_MODE } from "@/lib/tunes/types";

function shuffleIds(ids: string[]): string[] {
  const bag = [...ids];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function buildShuffleBag(trackIds: string[], avoidFirstId?: string): string[] {
  if (trackIds.length === 0) return [];
  if (trackIds.length === 1) return [...trackIds];

  let bag = shuffleIds(trackIds);
  if (avoidFirstId && bag[0] === avoidFirstId) {
    const swapIndex = bag.findIndex((id) => id !== avoidFirstId);
    if (swapIndex > 0) {
      [bag[0], bag[swapIndex]] = [bag[swapIndex], bag[0]];
    }
  }
  return bag;
}

export function buildQueueForMode(
  trackIds: string[],
  mode: TunesQueueMode,
  avoidFirstId?: string,
): string[] {
  if (trackIds.length === 0) return [];
  switch (mode) {
    case "sequential":
      return [...trackIds];
    case "shuffle_bag":
      return buildShuffleBag(trackIds, avoidFirstId);
    case "true_random":
      return [...trackIds];
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function pickTrueRandomTrackId(trackIds: string[]): string | undefined {
  if (trackIds.length === 0) return undefined;
  return trackIds[Math.floor(Math.random() * trackIds.length)];
}

export function pickNextTrackId(
  queue: TunesQueueState,
  playlistTrackIds: string[],
): { nextTrackId?: string; queue: TunesQueueState } {
  const mode = queue.mode ?? TUNES_DEFAULT_QUEUE_MODE;

  if (mode === "true_random") {
    const nextTrackId = pickTrueRandomTrackId(playlistTrackIds);
    return { nextTrackId, queue };
  }

  let queueTrackIds = [...queue.queueTrackIds];
  if (queueTrackIds.length === 0) {
    queueTrackIds = buildQueueForMode(playlistTrackIds, mode, queue.currentTrackId);
  }

  if (mode === "sequential") {
    if (!queue.currentTrackId) {
      const nextTrackId = queueTrackIds[0];
      return {
        nextTrackId,
        queue: { ...queue, queueTrackIds },
      };
    }
    const currentIndex = playlistTrackIds.indexOf(queue.currentTrackId);
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    if (nextIndex >= playlistTrackIds.length) {
      const nextTrackId = playlistTrackIds[0];
      return { nextTrackId, queue: { ...queue, queueTrackIds: [...playlistTrackIds] } };
    }
    return {
      nextTrackId: playlistTrackIds[nextIndex],
      queue: { ...queue, queueTrackIds: playlistTrackIds.slice(nextIndex) },
    };
  }

  // shuffle_bag: consume from temporary bag
  if (queueTrackIds.length === 0) {
    queueTrackIds = buildShuffleBag(playlistTrackIds, queue.currentTrackId);
  }
  const [nextTrackId, ...rest] = queueTrackIds;
  return {
    nextTrackId,
    queue: { ...queue, queueTrackIds: rest },
  };
}

export function pickPreviousTrackId(queue: TunesQueueState): string | undefined {
  const history = queue.historyTrackIds;
  if (history.length === 0) return undefined;
  return history[history.length - 1];
}

export function advanceQueueAfterTrack(
  queue: TunesQueueState,
  finishedTrackId: string,
  playlistTrackIds: string[],
): TunesQueueState {
  const historyTrackIds = [...queue.historyTrackIds, finishedTrackId].slice(-200);
  const { nextTrackId, queue: nextQueue } = pickNextTrackId(
    { ...queue, historyTrackIds, currentTrackId: finishedTrackId },
    playlistTrackIds,
  );
  return {
    ...nextQueue,
    historyTrackIds,
    currentTrackId: nextTrackId,
    isPlaying: Boolean(nextTrackId),
  };
}

export function skipCurrentTrack(
  queue: TunesQueueState,
  playlistTrackIds: string[],
): TunesQueueState {
  if (!queue.currentTrackId) {
    const { nextTrackId, queue: nextQueue } = pickNextTrackId(queue, playlistTrackIds);
    return { ...nextQueue, currentTrackId: nextTrackId, isPlaying: Boolean(nextTrackId) };
  }
  return advanceQueueAfterTrack(queue, queue.currentTrackId, playlistTrackIds);
}
