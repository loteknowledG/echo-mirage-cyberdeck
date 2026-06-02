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
import { LuPlay } from "react-icons/lu";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import {
  CYBERDECK_PANE_KINDS,
  CYBERDECK_PANE_REGISTRY,
  type CyberdeckPaneKind,
} from "@/features/cyberdeck/pane-registry";
import { ensurePickerSnappedToCenter } from "@/lib/embla-ios-picker-loop";
import { GLYPH_CHANNEL_PREVIEW_DECKS, PREVIEW_DECKS } from "./preview-data";
import { scrollMatrixTo, wrapIndex } from "./preview-matrix-nav";
import "./preview-matrix.css";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  const targetPaneLabel = CYBERDECK_PANE_REGISTRY[targetPane].label;
  const activeDecks = targetPane === "glyph-channel" ? GLYPH_CHANNEL_PREVIEW_DECKS : PREVIEW_DECKS;
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
    });

    deckEmblaRef.current = deckEmbla;
    deckEmbla.on("select", syncFromEmbla);
    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      activeDeckIndexRef.current,
      activeCardIndexRef.current,
      activeDecks.length,
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

  const playFocusedCard = useCallback(() => {
    const deck = activeDecks[activeDeckIndex];
    const card = deck?.cards[activeCardIndex];
    if (!deck || !card) return;
    setStackLogHtml(
      `Played <strong>${card.title}</strong> from <strong>${deck.name}</strong> against <strong>${targetPaneLabel}</strong>. Card would be pushed to Stack. Execution still blocked in prototype.`,
    );
  }, [activeDeckIndex, activeCardIndex, activeDecks, targetPaneLabel]);

  const navigateCard = useCallback(
    (direction: 1 | -1) => {
      const deck = activeDecks[activeDeckIndex];
      if (!deck || deck.cards.length < 1) return;

      const handEmbla = handEmblaRefs.current[activeDeckIndex];
      if (!handEmbla) return;
      if (direction < 0) handEmbla.scrollPrev();
      else handEmbla.scrollNext();
    },
    [activeDeckIndex, activeDecks],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const deckEmbla = deckEmblaRef.current;
      if (!deckEmbla) return;
      if (event.key === "ArrowUp") deckEmbla.scrollPrev();
      if (event.key === "ArrowDown") deckEmbla.scrollNext();
      if (event.key === "ArrowLeft") navigateCard(-1);
      if (event.key === "ArrowRight") navigateCard(1);
      if (event.key === "Enter") playFocusedCard();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigateCard, playFocusedCard]);

  const handlePlayCard = useCallback(
    (deckIndex: number, cardIndex: number) => {
      applyFocus(deckIndex, cardIndex);
      const deck = activeDecks[deckIndex];
      const card = deck.cards[cardIndex];
      setStackLogHtml(
        `Played <strong>${card.title}</strong> from <strong>${deck.name}</strong> against <strong>${targetPaneLabel}</strong>. Card would be pushed to Stack. Execution still blocked in prototype.`,
      );
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

  const handleCardPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, deckIndex: number, cardIndex: number) => {
      if (event.button !== 0 || !event.isPrimary) return;
      cancelCardHold();
      applyFocus(deckIndex, cardIndex);
      const key = `${deckIndex}:${cardIndex}`;
      const timer = setTimeout(() => {
        if (cardHoldRef.current?.key !== key) return;
        cardHoldRef.current = null;
        setArmingCardKey(null);
        handlePlayCard(deckIndex, cardIndex);
      }, 900);
      cardHoldRef.current = {
        key,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        timer,
      };
      setArmingCardKey(key);
    },
    [applyFocus, cancelCardHold, handlePlayCard],
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

  useEffect(() => cancelCardHold, [cancelCardHold]);

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

  return (
    <div className="powerfist-preview-root" data-compact-cards={isCompactCards ? "true" : "false"}>
      <main className="shell" ref={paneRef}>
        <section className="status powerfistComposer">
          <form className="powerfistMessageBox" onSubmit={handleMessageSubmit}>
            <div className="powerfistPaneRoller">
              <CyberdeckRollingPicker
                items={paneRollerItems}
                value={targetPane}
                onChange={handleTargetPaneChange}
                ariaLabel="PowerFist target pane"
                viewportClassName="powerfistPaneRollerViewport"
                alwaysShowLabel
                showTextWhileScrolling
                loop
              />
            </div>
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
                              <div className="card">
                                {armingCardKey === cardKey ? (
                                  <svg
                                    aria-hidden
                                    className="cardHoldTrace"
                                    preserveAspectRatio="none"
                                    viewBox="0 0 100 100"
                                  >
                                    <rect
                                      className="cardHoldTracePath"
                                      x="1"
                                      y="1"
                                      width="98"
                                      height="98"
                                      rx="6"
                                      ry="6"
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
                                  <button
                                    type="button"
                                    className="play"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handlePlayCard(deckIndex, cardIndex);
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                  >
                                    Play
                                  </button>
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
          </section>
          {isCompactCards ? (
            <div className="compactCardControls">
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlLeft"
                aria-label="Previous card"
                onClick={() => navigateCard(-1)}
              >
                ←
              </button>
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlRight"
                aria-label="Next card"
                onClick={() => navigateCard(1)}
              >
                →
              </button>
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlUp"
                aria-label="Previous deck"
                onClick={() => deckEmblaRef.current?.scrollPrev()}
              >
                ↑
              </button>
              <button
                type="button"
                className="dpadBtn compactCardControl compactCardControlDown"
                aria-label="Next deck"
                onClick={() => deckEmblaRef.current?.scrollNext()}
              >
                ↓
              </button>
            </div>
          ) : null}
        </section>

        <section className="controls">
          {!isCompactCards ? (
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
                aria-label="Previous deck"
                disabled={isDraggingDpad}
                onClick={() => deckEmblaRef.current?.scrollPrev()}
              >
                ↑
              </button>
              <button
                type="button"
                className="dpadBtn dpadLeft"
                aria-label="Previous card"
                disabled={isDraggingDpad}
                onClick={() => navigateCard(-1)}
              >
                ←
              </button>
              <button
                type="button"
                className="dpadBtn dpadPlay"
                aria-label="Play focused card"
                disabled={isDraggingDpad}
                onClick={playFocusedCard}
              >
                <LuPlay aria-hidden className="dpadPlayIcon" />
              </button>
              <button
                type="button"
                className="dpadBtn dpadRight"
                aria-label="Next card"
                disabled={isDraggingDpad}
                onClick={() => navigateCard(1)}
              >
                →
              </button>
              <button
                type="button"
                className="dpadBtn dpadDown"
                aria-label="Next deck"
                disabled={isDraggingDpad}
                onClick={() => deckEmblaRef.current?.scrollNext()}
              >
                ↓
              </button>
            </motion.div>
          ) : null}
        </section>

        <section
          className="stackLog"
          dangerouslySetInnerHTML={{ __html: stackLogHtml }}
        />
      </main>
    </div>
  );
}
