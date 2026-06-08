"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { motion } from "motion/react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import {
  CYBERDECK_PANE_KINDS,
  CYBERDECK_PANE_REGISTRY,
  type CyberdeckPaneKind,
} from "@/features/cyberdeck/pane-registry";
import { ensurePickerSnappedToCenter } from "@/lib/embla-ios-picker-loop";
import {
  POWERFIST_STACK_CHANNEL,
  POWERFIST_STACK_PUSH_EVENT,
  type PowerFistStackCommand,
} from "@/lib/cyberdeck/powerfist-events";
import { GLYPH_CHANNEL_PREVIEW_DECKS, PREVIEW_DECKS } from "./preview-data";
import { scrollMatrixTo, wrapIndex } from "./preview-matrix-nav";
import { PowerfistRectController } from "./powerfist-rect-controller";
import "./preview-matrix.css";

const CARD_PLAY_TRAIL_DURATION_MS = 900;
const CARD_PUSH_RECEIPT_DURATION_MS = 2400;
const CARD_PLAY_TRACE_PATH =
  "M 50 1 L 93 1 A 6 6 0 0 1 99 7 L 99 93 A 6 6 0 0 1 93 99 L 7 99 A 6 6 0 0 1 1 93 L 1 7 A 6 6 0 0 1 7 1 L 50 1";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cardChatMessage(
  deckName: string,
  targetPaneLabel: string,
  card: (typeof PREVIEW_DECKS)[number]["cards"][number],
): string {
  const preview =
    card.preview?.kind === "figlet"
      ? ` Render the result as figlet using the "${card.preview.value}" font.`
      : card.preview?.kind === "oneline"
        ? ` Include this one-line ASCII artifact: ${card.preview.value}`
        : "";
  return `POWERFIST STACK PUSH // "${card.title}" from "${deckName}" against ${targetPaneLabel}. ${card.purpose}${preview}`;
}

export function PreviewMatrix() {
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [stackLogHtml, setStackLogHtml] = useState("Stack idle.");
  const [isDraggingDpad, setIsDraggingDpad] = useState(false);
  const [isCompactCards, setIsCompactCards] = useState(false);
  const [targetPane, setTargetPane] = useState<CyberdeckPaneKind>("operator");
  const [message, setMessage] = useState("");
  const [armingCardKey, setArmingCardKey] = useState<string | null>(null);
  const [armedCardKey, setArmedCardKey] = useState<string | null>(null);
  const [pushReceiptHtml, setPushReceiptHtml] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<"stack" | "side">("stack");
  const [splitSize, setSplitSize] = useState(108);

  const matrixRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const deckViewportRef = useRef<HTMLDivElement>(null);
  const handViewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const deckEmblaRef = useRef<EmblaCarouselType | null>(null);
  const handEmblaRefs = useRef<(EmblaCarouselType | null)[]>([]);
  const activeDeckIndexRef = useRef(activeDeckIndex);
  const activeCardIndexRef = useRef(activeCardIndex);
  const cardHoldRef = useRef<{
    key: string;
    pointerId: number;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const pushReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splitDragRef = useRef<{ start: number; size: number; mode: "stack" | "side" } | null>(
    null,
  );

  const targetPaneLabel = CYBERDECK_PANE_REGISTRY[targetPane].label;
  const activeDecks = targetPane === "glyph-channel" ? GLYPH_CHANNEL_PREVIEW_DECKS : PREVIEW_DECKS;
  const armedCard = useMemo(() => {
    if (!armedCardKey) return null;
    const [deckIndex, cardIndex] = armedCardKey.split(":").map(Number);
    const deck = activeDecks[deckIndex];
    const card = deck?.cards[cardIndex];
    return deck && card ? { card, cardIndex, deck, deckIndex } : null;
  }, [activeDecks, armedCardKey]);
  const paneRollerItems = useMemo(
    () =>
      CYBERDECK_PANE_KINDS.map((kind) => {
        const label = CYBERDECK_PANE_REGISTRY[kind].label;
        return {
          value: kind,
          label,
          slide: <span className="powerfistPaneRollerLabel">{label}</span>,
        };
      }),
    [],
  );

  const setActiveFocus = useCallback((deckIndex: number, cardIndex: number) => {
    activeDeckIndexRef.current = deckIndex;
    activeCardIndexRef.current = cardIndex;
    setActiveDeckIndex(deckIndex);
    setActiveCardIndex(cardIndex);
  }, []);

  const applyFocus = useCallback((deckIndex: number, cardIndex: number) => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;

    const deckCount = activeDecks.length;
    const cardCount = activeDecks[wrapIndex(deckIndex, deckCount)]?.cards.length ?? 0;
    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      deckIndex,
      cardIndex,
      deckCount,
    );
    setActiveFocus(next.deckIndex, next.cardIndex);
  }, [activeDecks, setActiveFocus]);

  const syncFromEmbla = useCallback(() => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;
    const deckIdx = deckEmbla.selectedScrollSnap();
    const handEmbla = handEmblaRefs.current[deckIdx];
    setActiveFocus(deckIdx, handEmbla?.selectedScrollSnap() ?? 0);
  }, [setActiveFocus]);

  const recenterSelectedCard = useCallback(() => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;
    const deckCount = activeDecks.length;
    if (deckCount < 1) return;

    // Re-measure all carousels, then restore the UI's selected deck/card as the canonical focus.
    deckEmbla.reInit();
    handEmblaRefs.current.forEach((embla) => embla?.reInit());

    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      activeDeckIndexRef.current,
      activeCardIndexRef.current,
      deckCount,
      { jump: true },
    );
    setActiveFocus(next.deckIndex, next.cardIndex);
  }, [activeDecks, setActiveFocus]);

  const mountCarousels = useCallback(() => {
    const deckViewport = deckViewportRef.current;
    const matrix = matrixRef.current;
    if (!deckViewport || !matrix || deckViewport.clientHeight < 8 || matrix.clientHeight < 8) {
      return false;
    }

    deckEmblaRef.current?.destroy();
    handEmblaRefs.current.forEach((embla) => embla?.destroy());
    handEmblaRefs.current = [];

    activeDecks.forEach((_, deckIndex) => {
      const handViewport = handViewportRefs.current[deckIndex];
      if (!handViewport) return;

      const handEmbla = EmblaCarousel(handViewport, {
        axis: "x",
        loop: true,
        align: "center",
        dragFree: true,
        skipSnaps: false,
        containScroll: false,
      });

      handEmblaRefs.current[deckIndex] = handEmbla;

      handEmbla.on("select", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== deckIndex) return;
        const nextCardIndex = handEmbla.selectedScrollSnap();
        activeCardIndexRef.current = nextCardIndex;
        setActiveCardIndex(nextCardIndex);
      });

      handEmbla.on("settle", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== deckIndex) return;
        if (ensurePickerSnappedToCenter(handEmbla)) return;
        const nextCardIndex = handEmbla.selectedScrollSnap();
        activeCardIndexRef.current = nextCardIndex;
        setActiveCardIndex(nextCardIndex);
      });
    });

    const deckEmbla = EmblaCarousel(deckViewport, {
      axis: "y",
      loop: activeDecks.length > 1,
      align: "center",
      dragFree: false,
      containScroll: false,
      duration: 30,
    });

    deckEmblaRef.current = deckEmbla;
    // Defer focus until scroll settles so deck bands slide before selection updates.
    deckEmbla.on("settle", syncFromEmbla);
    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      activeDeckIndexRef.current,
      activeCardIndexRef.current,
      activeDecks.length,
      { jump: true },
    );
    setActiveFocus(next.deckIndex, next.cardIndex);

    return true;
  }, [activeDecks, setActiveFocus, syncFromEmbla]);

  useLayoutEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const tryMount = () => {
      if (cancelled) return false;
      return mountCarousels();
    };

    if (!tryMount()) {
      const matrix = matrixRef.current;
      if (matrix) {
        resizeObserver = new ResizeObserver(() => {
          if (tryMount()) resizeObserver?.disconnect();
        });
        resizeObserver.observe(matrix);
      }
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      deckEmblaRef.current?.destroy();
      deckEmblaRef.current = null;
      handEmblaRefs.current.forEach((embla) => embla?.destroy());
      handEmblaRefs.current = [];
    };
  }, [mountCarousels]);

  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        requestAnimationFrame(() => {
          if (!deckEmblaRef.current) {
            mountCarousels();
            return;
          }
          syncFromEmbla();
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(matrix);
    return () => observer.disconnect();
  }, [mountCarousels, syncFromEmbla]);

  useEffect(() => {
    const matrix = matrixRef.current;
    const deckViewport = deckViewportRef.current;
    if (!matrix || !deckViewport) return;

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setIsCompactCards(matrix.clientWidth <= 520);
        recenterSelectedCard();
      });
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(matrix);
    observer.observe(deckViewport);

    const activeHandViewport = handViewportRefs.current[activeDeckIndex];
    if (activeHandViewport) observer.observe(activeHandViewport);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [activeDeckIndex, recenterSelectedCard]);

  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;
    setIsCompactCards(matrix.clientWidth <= 520);
    const raf = requestAnimationFrame(() => recenterSelectedCard());
    return () => cancelAnimationFrame(raf);
  }, [isCompactCards, recenterSelectedCard]);

  const navigateCard = useCallback(
    (direction: 1 | -1) => {
      if (armedCardKey) return;
      const deck = activeDecks[activeDeckIndex];
      if (!deck || deck.cards.length < 1) return;

      const handEmbla = handEmblaRefs.current[activeDeckIndex];
      if (!handEmbla) return;
      if (direction < 0) handEmbla.scrollPrev();
      else handEmbla.scrollNext();
    },
    [activeDeckIndex, activeDecks, armedCardKey],
  );

  /** Vertical deck band: smooth scroll like dragging the deck viewport (not jump/fade). */
  const navigateDeck = useCallback(
    (direction: 1 | -1) => {
      if (armedCardKey) return;
      const deckEmbla = deckEmblaRef.current;
      if (!deckEmbla) return;
      if (direction < 0) deckEmbla.scrollNext();
      else deckEmbla.scrollPrev();
    },
    [armedCardKey],
  );

  const handlePushCard = useCallback(
    (deckIndex: number, cardIndex: number) => {
      applyFocus(deckIndex, cardIndex);
      const deck = activeDecks[deckIndex];
      const card = deck.cards[cardIndex];
      const chatMessage = cardChatMessage(deck.name, targetPaneLabel, card);
      const detail: PowerFistStackCommand = {
        kind: "powerfist-stack-push",
        actor: "operator",
        card: {
          deckName: deck.name,
          risk: card.risk,
          title: card.title,
          type: card.type,
        },
        commandId: crypto.randomUUID(),
        message: chatMessage,
        preparedArtifact: card.preview,
        targetPane: targetPaneLabel,
      };
      const event = new CustomEvent<PowerFistStackCommand>(POWERFIST_STACK_PUSH_EVENT, {
        cancelable: true,
        detail,
      });
      window.dispatchEvent(event);
      if (!event.defaultPrevented && "BroadcastChannel" in window) {
        const channel = new BroadcastChannel(POWERFIST_STACK_CHANNEL);
        channel.postMessage(detail);
        channel.close();
      }
      if (pushReceiptTimerRef.current) clearTimeout(pushReceiptTimerRef.current);
      setPushReceiptHtml(
        `Pushed <strong>${card.title}</strong> from <strong>${deck.name}</strong> onto the Echo Mirage command stack against <strong>${targetPaneLabel}</strong>.`,
      );
      pushReceiptTimerRef.current = setTimeout(() => {
        setPushReceiptHtml(null);
        pushReceiptTimerRef.current = null;
      }, CARD_PUSH_RECEIPT_DURATION_MS);
    },
    [activeDecks, applyFocus, targetPaneLabel],
  );

  const cancelCardHold = useCallback(() => {
    const hold = cardHoldRef.current;
    if (!hold) return;
    clearTimeout(hold.timer);
    cardHoldRef.current = null;
    setArmingCardKey(null);
  }, []);

  const resetCardPlay = useCallback(() => {
    cancelCardHold();
    const openedCardKey = armedCardKey;
    setArmedCardKey(null);
    if (!openedCardKey) return;
    const [deckIndex, cardIndex] = openedCardKey.split(":").map(Number);
    requestAnimationFrame(() => applyFocus(deckIndex, cardIndex));
  }, [applyFocus, armedCardKey, cancelCardHold]);

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

  useEffect(
    () => cancelCardHold,
    [cancelCardHold],
  );

  useEffect(
    () => () => {
      if (pushReceiptTimerRef.current) clearTimeout(pushReceiptTimerRef.current);
    },
    [],
  );

  const queueMessage = useCallback(
    () => {
      const instruction = (messageInputRef.current?.value ?? message).trim();
      if (!instruction) return;
      setStackLogHtml(
        `Queued instruction for <strong>${targetPaneLabel}</strong>: ${escapeHtml(instruction)}`,
      );
      setMessage("");
    },
    [message, targetPaneLabel],
  );

  const handleMessageSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      queueMessage();
    },
    [queueMessage],
  );

  const handleTargetPaneChange = useCallback((next: string) => {
    activeDeckIndexRef.current = 0;
    activeCardIndexRef.current = 0;
    setActiveDeckIndex(0);
    setActiveCardIndex(0);
    setTargetPane(next as CyberdeckPaneKind);
  }, []);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const applySplitMode = () => {
      const rect = pane.getBoundingClientRect();
      const nextMode: "stack" | "side" = rect.width > rect.height ? "side" : "stack";
      setSplitMode(nextMode);
      setSplitSize((current) => {
        const min = nextMode === "side" ? 260 : 84;
        const maxBase = nextMode === "side" ? rect.width : rect.height;
        const max =
          nextMode === "side"
            ? Math.max(min + 80, Math.floor(maxBase * 0.55))
            : Math.max(min + 30, Math.min(220, Math.floor(maxBase * 0.3)));
        const fallback = nextMode === "side" ? 320 : 108;
        return Math.min(max, Math.max(min, current || fallback));
      });
    };

    applySplitMode();
    const observer = new ResizeObserver(applySplitMode);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  const beginSplitResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();

      splitDragRef.current = {
        start: splitMode === "side" ? event.clientX : event.clientY,
        size: splitSize,
        mode: splitMode,
      };

      const onMove = (moveEvent: PointerEvent) => {
        const drag = splitDragRef.current;
        const pane = paneRef.current;
        if (!drag || !pane) return;

        const cursor = drag.mode === "side" ? moveEvent.clientX : moveEvent.clientY;
        const delta = cursor - drag.start;
        const rect = pane.getBoundingClientRect();
        const min = drag.mode === "side" ? 260 : 84;
        const maxBase = drag.mode === "side" ? rect.width : rect.height;
        const max =
          drag.mode === "side"
            ? Math.max(min + 80, Math.floor(maxBase * 0.55))
            : Math.max(min + 30, Math.min(220, Math.floor(maxBase * 0.3)));
        const next = Math.min(max, Math.max(min, drag.size + delta));
        setSplitSize(next);
      };

      const onUp = () => {
        splitDragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [splitMode, splitSize],
  );

  return (
    <div className="powerfist-preview-root" data-compact-cards={isCompactCards ? "true" : "false"}>
      <main className="shell" ref={paneRef}>
        <div
          className="powerfistSplitLayout"
          data-split-mode={splitMode}
          style={{ ["--pf-split-size" as string]: `${splitSize}px` }}
        >
          <section className="status powerfistComposer">
            <form className="powerfistMessageBox" onSubmit={handleMessageSubmit}>
              <input
                ref={messageInputRef}
                aria-label="PowerFist instruction"
                className="powerfistMessageInput"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Issue instruction to selected pane"
              />
              <button className="powerfistMessageSend" type="button" onClick={queueMessage}>
                Queue
              </button>
            </form>
          </section>

          <button
            type="button"
            className="powerfistSplitHandle"
            aria-label="Resize message and matrix panes"
            aria-orientation={splitMode === "side" ? "vertical" : "horizontal"}
            onPointerDown={beginSplitResize}
          />

          <section className="matrixStage">
          <section className="matrix" ref={matrixRef} data-testid="preview-matrix">
            <div className="deckViewport" ref={deckViewportRef}>
              <div className="deckContainer">
                {activeDecks.map((deck, deckIndex) => (
                  <section
                    key={deck.name}
                    className={`deckSlide${deckIndex === activeDeckIndex ? " is-selected" : ""}`}
                    data-deck-index={deckIndex}
                  >
                    <div
                      className="handViewport"
                      ref={(el) => {
                        handViewportRefs.current[deckIndex] = el;
                      }}
                    >
                      <div className="handContainer">
                        {deck.cards.map((card, cardIndex) => {
                          const isSelected =
                            deckIndex === activeDeckIndex && cardIndex === activeCardIndex;
                          const cardKey = `${deckIndex}:${cardIndex}`;
                          const isArming = armingCardKey === cardKey;
                          const isArmed = armedCardKey === cardKey;
                          return (
                            <article
                              key={`${deck.name}-${card.title}`}
                              className={`cardSlide${isSelected ? " is-selected" : ""}`}
                              data-card-index={cardIndex}
                              data-testid={`card-slide-${deckIndex}-${cardIndex}`}
                              onPointerDown={(event) =>
                                handleCardPointerDown(event, deckIndex, cardIndex)
                              }
                              onPointerMove={handleCardPointerMove}
                              onPointerUp={cancelCardHold}
                              onPointerCancel={cancelCardHold}
                            >
                              <div
                                className={`card${isArming ? " is-arming" : ""}${isArmed ? " is-armed" : ""}`}
                              >
                                {isArming ? (
                                  <svg
                                    aria-hidden
                                    className="cardPlayTrace"
                                    preserveAspectRatio="none"
                                    viewBox="0 0 100 100"
                                  >
                                    <path
                                      className="cardPlayTracePath"
                                      d={CARD_PLAY_TRACE_PATH}
                                      pathLength="1"
                                    />
                                  </svg>
                                ) : null}
                                <div className="cardTop">
                                  <div className="cardType">{card.type}</div>
                                  <div className="cardTitle">{card.title}</div>
                                  {card.preview?.kind === "oneline" ? (
                                    <pre className="cardArtifactPreview cardArtifactPreviewOneline">
                                      {card.preview.value}
                                    </pre>
                                  ) : null}
                                  {card.preview?.kind === "figlet" ? (
                                    <div className="cardArtifactPreview cardArtifactPreviewFiglet">
                                      <FigletFontPreviewSlide
                                        font={card.preview.value}
                                        active={isSelected}
                                        loadPreview={isSelected}
                                        size="lg"
                                      />
                                    </div>
                                  ) : null}
                                  <div className="cardPurpose">{card.purpose}</div>
                                </div>
                                <div className="cardBottom">
                                  <span className={`risk ${card.risk}`}>{card.risk}</span>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
            {armedCard ? (
              <section className="cardOpenViewport" data-testid="powerfist-open-card">
                <div className="cardOpenViewportHeader">
                  <div>
                    <div className="cardArmedPanelStatus">
                      <span className="cardArmedPanelDot" aria-hidden />
                      Prepared // Locked
                    </div>
                    <h2 className="cardOpenViewportTitle">{armedCard.card.title}</h2>
                  </div>
                  <span className={`risk ${armedCard.card.risk}`}>{armedCard.card.risk}</span>
                </div>
                <div className="cardOpenViewportBody">
                  <div className="cardOpenViewportType">{armedCard.card.type}</div>
                  {armedCard.card.preview?.kind === "figlet" ? (
                    <div className="cardOpenViewportArtifact">
                      <FigletFontPreviewSlide
                        font={armedCard.card.preview.value}
                        active
                        loadPreview
                        size="lg"
                      />
                    </div>
                  ) : null}
                  {armedCard.card.preview?.kind === "oneline" ? (
                    <pre className="cardOpenViewportArtifact cardOpenViewportAscii">
                      {armedCard.card.preview.value}
                    </pre>
                  ) : null}
                  <p className="cardOpenViewportPurpose">{armedCard.card.purpose}</p>
                </div>
                <div className="cardOpenViewportActions">
                  <button type="button" className="cardClose" onClick={resetCardPlay}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="push"
                    onClick={() => {
                      handlePushCard(armedCard.deckIndex, armedCard.cardIndex);
                      resetCardPlay();
                    }}
                  >
                    Push
                  </button>
                </div>
              </section>
            ) : null}
            {pushReceiptHtml ? (
              <div
                aria-live="polite"
                className="cardPushReceipt"
                data-testid="powerfist-push-receipt"
                dangerouslySetInnerHTML={{ __html: pushReceiptHtml }}
                role="status"
              />
            ) : null}
          </section>
          {isCompactCards && !armedCardKey ? (
            <div className="compactCardControls">
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlLeft"
                aria-label="Move cards left"
                disabled={Boolean(armedCardKey)}
                onClick={() => navigateCard(1)}
              >
                ←
              </button>
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlRight"
                aria-label="Move cards right"
                disabled={Boolean(armedCardKey)}
                onClick={() => navigateCard(-1)}
              >
                →
              </button>
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlUp"
                aria-label="Move deck up"
                disabled={Boolean(armedCardKey)}
                onClick={() => navigateDeck(-1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlDown"
                aria-label="Move deck down"
                disabled={Boolean(armedCardKey)}
                onClick={() => navigateDeck(1)}
              >
                ↓
              </button>
            </div>
          ) : null}

          {!armedCardKey && !isCompactCards ? (
            <PowerfistRectController
              constraintsRef={paneRef}
              disabled={Boolean(armedCardKey)}
              paneRollerItems={paneRollerItems}
              targetPane={targetPane}
              onTargetPaneChange={handleTargetPaneChange}
              onNavigateCard={(delta) => navigateCard(delta === 1 ? 1 : -1)}
              onDeckUp={() => navigateDeck(-1)}
              onDeckDown={() => navigateDeck(1)}
            />
          ) : null}

          <section className="controls">
          {!armedCardKey ? (
              <motion.div
                className="dpad"
                aria-label="Matrix navigation"
                drag
                dragConstraints={paneRef}
                dragMomentum
                onDragStart={() => setIsDraggingDpad(true)}
                onDragEnd={() => setIsDraggingDpad(false)}
              >
                <button
                  type="button"
                  className="dpadBtn dpadUp"
                  aria-label="Move deck up"
                  disabled={isDraggingDpad || Boolean(armedCardKey)}
                  onClick={() => navigateDeck(-1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="dpadBtn dpadLeft"
                  aria-label="Move cards left"
                  disabled={isDraggingDpad || Boolean(armedCardKey)}
                  onClick={() => navigateCard(1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="dpadBtn dpadPaneRoller"
                  aria-label="Set target pane"
                  disabled={isDraggingDpad}
                >
                  <CyberdeckRollingPicker
                    items={paneRollerItems}
                    value={targetPane}
                    onChange={handleTargetPaneChange}
                    ariaLabel="PowerFist target pane"
                    viewportClassName="powerfistPaneRollerViewport powerfistPaneRollerViewportDpad"
                    alwaysShowLabel
                    showTextWhileScrolling
                    loop
                  />
                </button>
                <button
                  type="button"
                  className="dpadBtn dpadRight"
                  aria-label="Move cards right"
                  disabled={isDraggingDpad || Boolean(armedCardKey)}
                  onClick={() => navigateCard(-1)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="dpadBtn dpadDown"
                  aria-label="Move deck down"
                  disabled={isDraggingDpad || Boolean(armedCardKey)}
                  onClick={() => navigateDeck(1)}
                >
                  ↓
                </button>
              </motion.div>
            ) : null}
          </section>
          </section>
        </div>

        <section
          className="stackLog"
          dangerouslySetInnerHTML={{ __html: stackLogHtml }}
        />
      </main>
    </div>
  );
}
