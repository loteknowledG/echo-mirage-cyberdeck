"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EmblaCarousel, { EmblaCarouselType } from "embla-carousel";
import { type ExecutionCard, EXECUTION_CARD_REGISTRY, EXECUTION_HANDS } from "@/lib/computer-use/execution-card-registry";

type RollADeckProps = {
  onPlayCard?: (cardId: string, deckIndex: number) => void;
  onDeckChange?: (deckIndex: number) => void;
  onCardChange?: (cardIndex: number, deckIndex: number) => void;
};

const RISK_COLORS: Record<string, string> = {
  safe: "#22c55e",
  caution: "#f59e0b",
  restricted: "#ef4444",
};

const RISK_LABELS: Record<string, string> = {
  safe: "SAFE",
  caution: "CAUTION",
  restricted: "RESTRICTED",
};

const CATEGORY_COLORS: Record<string, string> = {
  review: "#8b5cf6",
  capture: "#06b6d4",
  runtime: "#f97316",
  system: "#6366f1",
  teaching: "#ec4899",
  recovery: "#10b981",
  memory: "#64748b",
  surface: "#78716c",
};

type Deck = {
  id: string;
  name: string;
  badge: string;
  cards: ExecutionCard[];
};

function buildDecks(): Deck[] {
  const registry = EXECUTION_CARD_REGISTRY;
  return EXECUTION_HANDS.map((hand) => ({
    id: hand.id,
    name: hand.name.toUpperCase(),
    badge: hand.id,
    cards: hand.cards.map((id) => registry[id]).filter(Boolean),
  }));
}

function CardSlide({
  card,
  isSelected,
  onClick,
}: {
  card: ExecutionCard;
  isSelected: boolean;
  onClick: () => void;
}) {
  const riskColor = RISK_COLORS[card.risk] ?? "#8a8a8a";
  const categoryColor = CATEGORY_COLORS[card.category] ?? "#8a8a8a";

  return (
    <div
      className={`card-slide flex-[0_0_42%] min-w-0 cursor-pointer p-3 transition-all duration-200 ${
        isSelected ? "scale-100 opacity-100" : "scale-90 opacity-50"
      }`}
      onClick={onClick}
    >
      <div
        className="flex h-full flex-col justify-between rounded-2xl border p-5"
        style={{
          borderColor: isSelected ? "rgba(134, 239, 172, 0.5)" : "rgba(134, 239, 172, 0.2)",
          background: "linear-gradient(145deg, rgba(13, 31, 23, 0.95), rgba(5, 10, 8, 0.98))",
          boxShadow: isSelected
            ? "inset 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.5)"
            : "inset 0 0 0 1px rgba(255,255,255,0.03), 0 12px 36px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <span
              className="font-mono text-[11px] tracking-[0.12em] uppercase"
              style={{ color: categoryColor }}
            >
              {card.category}
            </span>
            <span
              className="rounded-full border px-2 py-1 font-mono text-[10px] tracking-[0.06em]"
              style={{ color: riskColor, borderColor: `${riskColor}40` }}
            >
              {RISK_LABELS[card.risk]}
            </span>
          </div>
          <h3 className="font-mono text-xl leading-tight tracking-wide text-[#d8ffe5]">
            {card.name}
          </h3>
          <p className="font-mono text-[12px] leading-relaxed text-[#76a586]">
            {card.description}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          {card.requiresConfirmation && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-amber-400">
              CONFIRM
            </span>
          )}
          {!card.requiresConfirmation && <div />}
          <button
            type="button"
            className="rounded-xl border border-emerald-500/60 bg-emerald-500/15 px-4 py-2 font-mono text-[11px] tracking-[0.08em] text-emerald-400 transition hover:bg-emerald-500/25"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            PLAY
          </button>
        </div>
      </div>
    </div>
  );
}

export function RollADeck({ onPlayCard, onDeckChange, onCardChange }: RollADeckProps) {
  const decks = buildDecks();
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const deckViewportRef = useRef<HTMLDivElement>(null);
  const handViewportRefs = useRef<HTMLDivElement[]>([]);

  const deckEmblaRef = useRef<EmblaCarouselType | null>(null);
  const handEmblaRefs = useRef<(EmblaCarouselType | null)[]>([]);

  useEffect(() => {
    if (!deckViewportRef.current) return;

    const deckEmbla = EmblaCarousel(deckViewportRef.current, {
      axis: "y",
      loop: true,
      align: "center",
      containScroll: false,
    });

    deckEmblaRef.current = deckEmbla;

    deckEmbla.on("select", () => {
      const idx = deckEmbla.selectedScrollSnap();
      setActiveDeckIndex(idx);
      setActiveCardIndex(0);
      onDeckChange?.(idx);

      if (handEmblaRefs.current[idx]) {
        handEmblaRefs.current[idx].scrollTo(0);
      }
    });

    return () => {
      deckEmbla.destroy();
    };
  }, [decks.length, onDeckChange]);

  useEffect(() => {
    handViewportRefs.current.forEach((viewport, deckIdx) => {
      if (!viewport) return;

      const handEmbla = EmblaCarousel(viewport, {
        axis: "x",
        loop: true,
        align: "center",
        dragFree: true,
        containScroll: false,
      });

      handEmblaRefs.current[deckIdx] = handEmbla;

      handEmbla.on("select", () => {
        if (deckIdx !== deckEmblaRef.current?.selectedScrollSnap()) return;
        setActiveCardIndex(handEmbla.selectedScrollSnap());
        onCardChange?.(handEmbla.selectedScrollSnap(), deckIdx);
      });
    });

    return () => {
      handEmblaRefs.current.forEach((embla) => embla?.destroy());
      handEmblaRefs.current = [];
    };
  }, [decks.length, onCardChange]);

  const handleCardClick = useCallback(
    (cardIndex: number) => {
      const card = decks[activeDeckIndex].cards[cardIndex];
      onPlayCard?.(card.id, activeDeckIndex);
    },
    [activeDeckIndex, decks, onPlayCard],
  );

  const activeDeck = decks[activeDeckIndex];
  const activeCard = activeDeck?.cards[activeCardIndex];

  if (decks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="font-mono text-[12px] text-[#4a4a4a]">NO DECKS AVAILABLE</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col font-mono">
      <div className="flex items-center justify-between rounded-xl border border-[#1c1c1c] bg-black/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.08em] text-[#76a586]">DECK</span>
          <span
            className="font-mono text-[14px] tracking-[0.12em] text-[#86efac]"
            style={{ textShadow: "0 0 12px rgba(134,239,172,0.4)" }}
          >
            {activeDeck?.name}
          </span>
          <span className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.06em] text-[#6a6a6a]">
            {activeDeck?.badge}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.08em] text-[#76a586]">CARD</span>
          <span className="font-mono text-[14px] tracking-wide text-[#d8ffe5]">
            {activeCard?.name ?? "—"}
          </span>
        </div>
      </div>

      <div className="relative mt-4 flex-1 overflow-hidden rounded-2xl border border-[#1c1c1c] bg-black/60">
        <div
          ref={deckViewportRef}
          className="deck-viewport h-full overflow-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="deck-container flex h-full flex-col">
            {decks.map((deck, deckIndex) => (
              <div
                key={deck.id}
                className="deck-slide flex min-h-0 flex-1 flex-col gap-4 p-5"
              >
                <header className="flex items-center justify-between">
                  <h2 className="font-mono text-lg tracking-[0.12em] text-[#86efac]">
                    {deck.name}
                  </h2>
                  <span className="rounded-full border border-emerald-500/30 px-3 py-1 font-mono text-[10px] tracking-[0.08em] text-[#76a586]">
                    {deck.cards.length} cards
                  </span>
                </header>

                <div className="relative min-h-0 flex-1">
                  <div
                    ref={(el) => {
                      if (el) handViewportRefs.current[deckIndex] = el;
                    }}
                    className="hand-viewport h-full overflow-x-auto"
                    style={{
                      scrollbarWidth: "none",
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    <div className="hand-container flex h-full items-center">
                      {deck.cards.map((card, cardIndex) => (
                        <CardSlide
                          key={card.id}
                          card={card}
                          isSelected={deckIndex === activeDeckIndex && cardIndex === activeCardIndex}
                          onClick={() => handleCardClick(cardIndex)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => deckEmblaRef.current?.scrollPrev()}
            className="rounded-xl border border-[#2d2d2d] bg-black px-4 py-2 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/50 hover:text-emerald-300"
          >
            DECK ↑
          </button>
          <button
            type="button"
            onClick={() => deckEmblaRef.current?.scrollNext()}
            className="rounded-xl border border-[#2d2d2d] bg-black px-4 py-2 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/50 hover:text-emerald-300"
          >
            DECK ↓
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handEmblaRefs.current[activeDeckIndex]?.scrollPrev()}
            className="rounded-xl border border-[#2d2d2d] bg-black px-4 py-2 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/50 hover:text-emerald-300"
          >
            CARD ←
          </button>
          <button
            type="button"
            onClick={() => handEmblaRefs.current[activeDeckIndex]?.scrollNext()}
            className="rounded-xl border border-[#2d2d2d] bg-black px-4 py-2 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/50 hover:text-emerald-300"
          >
            CARD →
          </button>
        </div>

        <button
          type="button"
          onClick={() => activeCard && handleCardClick(activeCardIndex)}
          className="rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-6 py-2 font-mono text-[10px] tracking-[0.08em] text-emerald-400 transition hover:bg-emerald-500/25"
        >
          PLAY FOCUSED CARD
        </button>
      </div>

      <div className="mt-3 min-h-[32px] rounded-lg border border-[#1c1c1c] bg-black/60 px-4 py-2">
        <span className="font-mono text-[11px] text-[#6a6a6a]">
          {activeCard ? (
            <>
              Stack idle.{" "}
              <span className="text-amber-400">Ready to play {activeCard.name}</span>
            </>
          ) : (
            "Stack idle."
          )}
        </span>
      </div>
    </div>
  );
}