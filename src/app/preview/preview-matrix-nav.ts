import type { EmblaCarouselType } from "embla-carousel";

export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

export function scrollMatrixTo(
  deckEmbla: EmblaCarouselType,
  handEmblas: (EmblaCarouselType | null)[],
  deckIndex: number,
  cardIndex: number,
  deckCount: number,
): { deckIndex: number; cardIndex: number } {
  const deck = wrapIndex(deckIndex, deckCount);
  deckEmbla.scrollTo(deck, true);
  const hand = handEmblas[deck];
  const cardCount = hand?.scrollSnapList().length ?? 0;
  const card = wrapIndex(cardIndex, cardCount);
  hand?.scrollTo(card, true);
  return { deckIndex: deck, cardIndex: card };
}

export type MatrixDragDelta = {
  dx: number;
  dy: number;
};

/** Map drag release to deck/card index changes (supports diagonal). */
export function resolveMatrixDrag(
  startDeck: number,
  startCard: number,
  delta: MatrixDragDelta,
  deckCount: number,
  cardCount: number,
  thresholdPx = 36,
): { deckIndex: number; cardIndex: number } {
  let deck = startDeck;
  let card = startCard;
  const { dx, dy } = delta;

  if (Math.abs(dy) >= thresholdPx) {
    deck += dy > 0 ? 1 : -1;
  }
  if (Math.abs(dx) >= thresholdPx) {
    card += dx > 0 ? 1 : -1;
  }

  return {
    deckIndex: wrapIndex(deck, deckCount),
    cardIndex: wrapIndex(card, cardCount),
  };
}
