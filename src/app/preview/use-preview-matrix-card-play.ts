"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewDeckWithTarget } from "./preview-data";
import { CARD_PLAY_TRAIL_DURATION_MS } from "./preview-matrix-play";

export type ArmedPanelArmingMode = "push" | "cancel";

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
  onArmedPanelPush?: (deckIndex: number, cardIndex: number) => void;
};

function normalizeAngleDelta(delta: number): number {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

function isInteractiveArmedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button, input, textarea, select, label, a"));
}

export function usePreviewMatrixCardPlay({
  activeDecks,
  applyFocus,
  navigateCard,
  navigateDeck,
  onArmedPanelPush,
}: UsePreviewMatrixCardPlayOptions) {
  const [composerText, setComposerText] = useState("");
  const [armingCardKey, setArmingCardKey] = useState<string | null>(null);
  const [armedCardKey, setArmedCardKey] = useState<string | null>(null);
  const [armedPanelArming, setArmedPanelArming] = useState<ArmedPanelArmingMode | null>(null);
  const [armedPanelTraceKey, setArmedPanelTraceKey] = useState(0);

  const cardHoldRef = useRef<{
    key: string;
    pointerId: number;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const armedPanelHoldRef = useRef<{
    pointerId: number;
    mode: ArmedPanelArmingMode;
    angleSum: number;
    lastAngle: number;
    centerX: number;
    centerY: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const armedCard = useMemo((): ArmedCard | null => {
    if (!armedCardKey) return null;
    const [deckIndex, cardIndex] = armedCardKey.split(":").map(Number);
    const deck = activeDecks[deckIndex];
    const card = deck?.cards[cardIndex];
    return deck && card ? { card, cardIndex, deck, deckIndex } : null;
  }, [activeDecks, armedCardKey]);

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
    if (!openedCardKey) return;
    const [deckIndex, cardIndex] = openedCardKey.split(":").map(Number);
    requestAnimationFrame(() => applyFocus(deckIndex, cardIndex));
  }, [applyFocus, armedCardKey, cancelArmedPanelHold, cancelCardHold]);

  const completeArmedPanelHold = useCallback(
    (mode: ArmedPanelArmingMode) => {
      if (!armedCardKey) return;
      const [deckIndex, cardIndex] = armedCardKey.split(":").map(Number);
      armedPanelHoldRef.current = null;
      setArmedPanelArming(null);
      if (mode === "push") {
        onArmedPanelPush?.(deckIndex, cardIndex);
        cancelCardHold();
        setComposerText("");
        return;
      }
      cancelCardHold();
      setArmedCardKey(null);
      setComposerText("");
      requestAnimationFrame(() => applyFocus(deckIndex, cardIndex));
    },
    [applyFocus, armedCardKey, cancelCardHold, onArmedPanelPush],
  );

  const restartArmedPanelTimer = useCallback(
    (pointerId: number) => {
      const hold = armedPanelHoldRef.current;
      if (!hold || hold.pointerId !== pointerId) return;
      clearTimeout(hold.timer);
      setArmedPanelTraceKey((key) => key + 1);
      hold.timer = setTimeout(() => {
        const current = armedPanelHoldRef.current;
        if (!current || current.pointerId !== pointerId) return;
        completeArmedPanelHold(current.mode);
      }, CARD_PLAY_TRAIL_DURATION_MS);
    },
    [completeArmedPanelHold],
  );

  const handleCardPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, deckIndex: number, cardIndex: number) => {
      if (event.button !== 0 || !event.isPrimary) return;
      if (armedCardKey) return;
      cancelCardHold();
      setArmedCardKey(null);
      applyFocus(deckIndex, cardIndex);
      const key = `${deckIndex}:${cardIndex}`;
      const timer = setTimeout(() => {
        if (cardHoldRef.current?.key !== key) return;
        cardHoldRef.current = null;
        setArmingCardKey(null);
        setComposerText("");
        setArmedCardKey(key);
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
    [applyFocus, armedCardKey, cancelCardHold],
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

      cancelArmedPanelHold();
      const rect = event.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);

      const timer = setTimeout(() => {
        const hold = armedPanelHoldRef.current;
        if (!hold || hold.pointerId !== event.pointerId) return;
        completeArmedPanelHold(hold.mode);
      }, CARD_PLAY_TRAIL_DURATION_MS);

      armedPanelHoldRef.current = {
        pointerId: event.pointerId,
        mode: "push",
        angleSum: 0,
        lastAngle: startAngle,
        centerX,
        centerY,
        timer,
      };
      setArmedPanelTraceKey((key) => key + 1);
      setArmedPanelArming("push");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [armedCardKey, cancelArmedPanelHold, completeArmedPanelHold],
  );

  const handleArmedPanelPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const hold = armedPanelHoldRef.current;
      if (!hold || hold.pointerId !== event.pointerId) return;

      const angle = Math.atan2(event.clientY - hold.centerY, event.clientX - hold.centerX);
      hold.angleSum += normalizeAngleDelta(angle - hold.lastAngle);
      hold.lastAngle = angle;

      const ccwThreshold = -Math.PI / 3;
      const cwThreshold = Math.PI / 6;

      if (hold.angleSum < ccwThreshold && hold.mode !== "cancel") {
        hold.mode = "cancel";
        setArmedPanelArming("cancel");
        restartArmedPanelTimer(event.pointerId);
        return;
      }

      if (hold.angleSum > cwThreshold && hold.mode !== "push") {
        hold.mode = "push";
        setArmedPanelArming("push");
        restartArmedPanelTimer(event.pointerId);
      }
    },
    [restartArmedPanelTimer],
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

  return {
    armedCard,
    armedCardKey,
    armingCardKey,
    armedPanelArming,
    armedPanelTraceKey,
    composerText,
    setComposerText,
    cancelCardHold,
    cancelArmedPanelHold,
    resetCardPlay,
    handleCardPointerDown,
    handleCardPointerMove,
    handleArmedPanelPointerDown,
    handleArmedPanelPointerMove,
  };
}
