"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewDeckWithTarget } from "./preview-data";
import { CARD_PLAY_TRAIL_DURATION_MS, cardNeedsComposer } from "./preview-matrix-play";

export type ArmedPanelArmingMode = "cancel";

export type CardExecutionResult = {
  ok: boolean;
  message: string;
  keepArmed?: boolean;
  /** Optional visual payload (e.g. captured screenshot) shown on the result card. */
  imageDataUrl?: string;
  /** Optional long-form solution text (e.g. SOLVE answer) shown on the result card. */
  answerText?: string;
};

type ArmedCard = {
  card: PreviewDeckWithTarget["cards"][number];
  cardIndex: number;
  deck: PreviewDeckWithTarget;
  deckIndex: number;
};

type UsePreviewMatrixCardPlayOptions = {
  activeDecks: PreviewDeckWithTarget[];
  applyFocus: (deckIndex: number, cardIndex: number) => void;
  navigateCard: (direction: 1 | -1) => void;
  navigateDeck: (direction: 1 | -1) => void;
  /** Hold ×3 on a deck card executes immediately (unless the card needs a composer). */
  onExecuteCard?: (
    deckIndex: number,
    cardIndex: number,
  ) => Promise<CardExecutionResult | void> | CardExecutionResult | void;
  /** Fired whenever the open/armed card is dismissed (hold cancel, Escape, keepArmed false). */
  onArmedDismiss?: (armed: {
    deckIndex: number;
    cardIndex: number;
    card: PreviewDeckWithTarget["cards"][number];
  }) => void;
};

function isInteractiveArmedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // [data-armed-scroll] marks scrollable result content (e.g. solve answers)
  // that must not start the hold-to-cancel gesture.
  return Boolean(
    target.closest("button, input, textarea, select, label, a, [data-armed-scroll]"),
  );
}

export function usePreviewMatrixCardPlay({
  activeDecks,
  applyFocus,
  navigateCard,
  navigateDeck,
  onExecuteCard,
  onArmedDismiss,
}: UsePreviewMatrixCardPlayOptions) {
  const [composerText, setComposerText] = useState("");
  const [armingCardKey, setArmingCardKey] = useState<string | null>(null);
  const [armedCardKey, setArmedCardKey] = useState<string | null>(null);
  const [armedPanelArming, setArmedPanelArming] = useState<ArmedPanelArmingMode | null>(null);
  const [armedPanelTraceKey, setArmedPanelTraceKey] = useState(0);
  const [executionPending, setExecutionPending] = useState(false);
  const [executionResult, setExecutionResult] = useState<CardExecutionResult | null>(null);

  const cardHoldRef = useRef<{
    key: string;
    pointerId: number;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const armedPanelHoldRef = useRef<{
    pointerId: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const onExecuteCardRef = useRef(onExecuteCard);
  onExecuteCardRef.current = onExecuteCard;
  const onArmedDismissRef = useRef(onArmedDismiss);
  onArmedDismissRef.current = onArmedDismiss;

  const armedCard = useMemo((): ArmedCard | null => {
    if (!armedCardKey) return null;
    const [deckIndex, cardIndex] = armedCardKey.split(":").map(Number);
    const deck = activeDecks[deckIndex];
    const card = deck?.cards[cardIndex];
    return deck && card ? { card, cardIndex, deck, deckIndex } : null;
  }, [activeDecks, armedCardKey]);

  const dismissArmedCard = useCallback(
    (openedCardKey: string | null) => {
      if (!openedCardKey) return;
      const [deckIndex, cardIndex] = openedCardKey.split(":").map(Number);
      const deck = activeDecks[deckIndex];
      const card = deck?.cards[cardIndex];
      if (card) {
        onArmedDismissRef.current?.({ deckIndex, cardIndex, card });
      }
      requestAnimationFrame(() => applyFocus(deckIndex, cardIndex));
    },
    [activeDecks, applyFocus],
  );

  const cancelCardHold = useCallback(() => {
    const hold = cardHoldRef.current;
    if (!hold) return;
    clearTimeout(hold.timer);
    cardHoldRef.current = null;
    setArmingCardKey(null);
  }, []);

  const cancelArmedPanelHold = useCallback(() => {
    const hold = armedPanelHoldRef.current;
    if (!hold) return;
    clearTimeout(hold.timer);
    armedPanelHoldRef.current = null;
    setArmedPanelArming(null);
  }, []);

  const resetCardPlay = useCallback(() => {
    cancelCardHold();
    cancelArmedPanelHold();
    const openedCardKey = armedCardKey;
    setArmedCardKey(null);
    setComposerText("");
    setExecutionPending(false);
    setExecutionResult(null);
    dismissArmedCard(openedCardKey);
  }, [armedCardKey, cancelArmedPanelHold, cancelCardHold, dismissArmedCard]);

  const runCardExecution = useCallback(async (deckIndex: number, cardIndex: number) => {
    setExecutionPending(true);
    setExecutionResult(null);
    try {
      const result = await onExecuteCardRef.current?.(deckIndex, cardIndex);
      if (result && typeof result === "object") {
        setExecutionResult(result);
        if (result.keepArmed === false) {
          // Continuous stop / explicit dismiss after execute.
          setArmedCardKey(null);
          setComposerText("");
          setExecutionPending(false);
          dismissArmedCard(`${deckIndex}:${cardIndex}`);
          return result;
        }
      }
      return result;
    } finally {
      setExecutionPending(false);
    }
  }, [dismissArmedCard]);

  const handleCardPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, deckIndex: number, cardIndex: number) => {
      if (event.button !== 0 || !event.isPrimary) return;
      if (armedCardKey) return;
      cancelCardHold();
      setArmedCardKey(null);
      setExecutionResult(null);
      applyFocus(deckIndex, cardIndex);
      const key = `${deckIndex}:${cardIndex}`;
      const timer = setTimeout(() => {
        if (cardHoldRef.current?.key !== key) return;
        cardHoldRef.current = null;
        setArmingCardKey(null);
        setComposerText("");
        setArmedCardKey(key);

        const deck = activeDecks[deckIndex];
        const card = deck?.cards[cardIndex];
        // Composer cards open the large panel for input; everything else executes on activate.
        if (card && !cardNeedsComposer(card)) {
          void runCardExecution(deckIndex, cardIndex);
        }
      }, CARD_PLAY_TRAIL_DURATION_MS);
      cardHoldRef.current = {
        key,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        timer,
      };
      setArmingCardKey(key);
    },
    [activeDecks, applyFocus, armedCardKey, cancelCardHold, runCardExecution],
  );

  const handleCardPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const hold = cardHoldRef.current;
      if (!hold || hold.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY) > 10) {
        cancelCardHold();
      }
    },
    [cancelCardHold],
  );

  const handleArmedPanelPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !event.isPrimary || !armedCardKey) return;
      if (isInteractiveArmedTarget(event.target)) return;
      if (executionPending) return;

      cancelArmedPanelHold();

      const timer = setTimeout(() => {
        const hold = armedPanelHoldRef.current;
        if (!hold || hold.pointerId !== event.pointerId) return;
        armedPanelHoldRef.current = null;
        setArmedPanelArming(null);
        // 3-lap hold on the result card = cancel / dismiss (Listen: stop listening).
        const openedCardKey = armedCardKey;
        cancelCardHold();
        setArmedCardKey(null);
        setComposerText("");
        setExecutionResult(null);
        dismissArmedCard(openedCardKey);
      }, CARD_PLAY_TRAIL_DURATION_MS);

      armedPanelHoldRef.current = {
        pointerId: event.pointerId,
        timer,
      };
      setArmedPanelTraceKey((key) => key + 1);
      setArmedPanelArming("cancel");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [armedCardKey, cancelArmedPanelHold, cancelCardHold, dismissArmedCard, executionPending],
  );

  const handleArmedPanelPointerMove = useCallback(
    (_event: React.PointerEvent<HTMLElement>) => {
      // Result-card cancel is hold-only — no clockwise/ccw mode switching.
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (armedCardKey) {
        if (event.key === "Escape") resetCardPlay();
        return;
      }
      if (event.key === "ArrowUp") navigateDeck(-1);
      if (event.key === "ArrowDown") navigateDeck(1);
      if (event.key === "ArrowLeft") navigateCard(1);
      if (event.key === "ArrowRight") navigateCard(-1);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [armedCardKey, navigateCard, navigateDeck, resetCardPlay]);

  useEffect(() => {
    return () => {
      cancelCardHold();
      cancelArmedPanelHold();
    };
  }, [cancelArmedPanelHold, cancelCardHold]);

  // Phone long-press fires `contextmenu`; swallow it while a 3-lap hold is in progress.
  useEffect(() => {
    if (!armingCardKey && !armedPanelArming) return;
    const blockContextMenu = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("contextmenu", blockContextMenu, true);
    return () => document.removeEventListener("contextmenu", blockContextMenu, true);
  }, [armingCardKey, armedPanelArming]);

  return {
    armedCard,
    armedCardKey,
    armingCardKey,
    armedPanelArming,
    armedPanelTraceKey,
    composerText,
    setComposerText,
    executionPending,
    executionResult,
    setExecutionResult,
    runCardExecution,
    cancelCardHold,
    cancelArmedPanelHold,
    resetCardPlay,
    handleCardPointerDown,
    handleCardPointerMove,
    handleArmedPanelPointerDown,
    handleArmedPanelPointerMove,
  };
}
