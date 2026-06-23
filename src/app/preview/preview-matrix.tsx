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
import { PowerfistJoystickControls } from "./powerfist-joystick-controls";
import "./preview-matrix.css";

const CARD_PLAY_TRAIL_DURATION_MS = 900;
const CARD_PUSH_RECEIPT_DURATION_MS = 2400;
const CARD_PLAY_TRACE_PATH =
  "M 50 1 L 93 1 A 6 6 0 0 1 99 7 L 99 93 A 6 6 0 0 1 93 99 L 7 99 A 6 6 0 0 1 1 93 L 1 7 A 6 6 0 0 1 7 1 L 50 1";

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

function cardNeedsComposer(card: { toolOverride?: { composerArg?: string } }): boolean {
  return Boolean(card.toolOverride?.composerArg);
}

function composerPlaceholderForArg(arg: string): string {
  switch (arg) {
    case "filePath":
      return "Repo file path…";
    case "path":
      return "Filesystem path…";
    case "text":
      return "Text for tool argument…";
    default:
      return `Value for ${arg}…`;
  }
}

export function PreviewMatrix() {
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCompactCards, setIsCompactCards] = useState(false);
  const [targetPane, setTargetPane] = useState<CyberdeckPaneKind>("operator");
  const [composerText, setComposerText] = useState("");
  const [armingCardKey, setArmingCardKey] = useState<string | null>(null);
  const [armedCardKey, setArmedCardKey] = useState<string | null>(null);
  const [pushReceiptHtml, setPushReceiptHtml] = useState<string | null>(null);

  const matrixRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLElement>(null);
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
      loop: true,
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

    const syncCarousels = () => {
      if (cancelled) return;
      if (deckEmblaRef.current) {
        deckEmblaRef.current.reInit();
        handEmblaRefs.current.forEach((embla) => embla?.reInit());
        const deckCount = activeDecks.length;
        if (deckCount < 1) return;
        const next = scrollMatrixTo(
          deckEmblaRef.current,
          handEmblaRefs.current,
          activeDeckIndexRef.current,
          activeCardIndexRef.current,
          deckCount,
          { jump: true },
        );
        setActiveFocus(next.deckIndex, next.cardIndex);
        return;
      }
      mountCarousels();
    };

    syncCarousels();

    const matrix = matrixRef.current;
    if (matrix) {
      resizeObserver = new ResizeObserver(() => syncCarousels());
      resizeObserver.observe(matrix);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      deckEmblaRef.current?.destroy();
      deckEmblaRef.current = null;
      handEmblaRefs.current.forEach((embla) => embla?.destroy());
      handEmblaRefs.current = [];
    };
  }, [activeDecks, mountCarousels, setActiveFocus]);

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
      const composerSupplement = composerText.trim() || undefined;
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
        toolOverride: card.toolOverride,
        composerSupplement,
        preparedArtifact: card.preview,
        targetPane: targetPaneLabel,
      };
      if (composerSupplement && card.toolOverride?.composerArg) {
        setComposerText("");
      }
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
    [activeDecks, applyFocus, composerText, targetPaneLabel],
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
    setComposerText("");
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
        <div className="powerfistMainLayout">
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
                  {cardNeedsComposer(armedCard.card) ? (
                    <label className="cardOpenViewportComposer">
                      <span className="cardOpenViewportComposerLabel">
                        {armedCard.card.toolOverride?.composerArg}
                      </span>
                      <input
                        aria-label="PowerFist instruction"
                        className="powerfistMessageInput cardOpenViewportComposerInput"
                        value={composerText}
                        onChange={(event) => setComposerText(event.target.value)}
                        placeholder={composerPlaceholderForArg(
                          armedCard.card.toolOverride?.composerArg ?? "",
                        )}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          handlePushCard(armedCard.deckIndex, armedCard.cardIndex);
                          resetCardPlay();
                        }}
                      />
                    </label>
                  ) : null}
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
          {!armedCardKey ? (
            <PowerfistJoystickControls
              disabled={Boolean(armedCardKey)}
              paneRollerItems={paneRollerItems}
              targetPane={targetPane}
              onTargetPaneChange={handleTargetPaneChange}
              onNavigateCard={navigateCard}
              onNavigateDeck={navigateDeck}
            />
          ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
