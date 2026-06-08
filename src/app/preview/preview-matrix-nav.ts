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
  options?: { jump?: boolean },
): { deckIndex: number; cardIndex: number } {
  const jump = options?.jump ?? false;
  const deck = wrapIndex(deckIndex, deckCount);
  deckEmbla.scrollTo(deck, jump);
  const hand = handEmblas[deck];
  const cardCount = hand?.scrollSnapList().length ?? 0;
  const card = wrapIndex(cardIndex, cardCount);
  hand?.scrollTo(card, jump);
  return { deckIndex: deck, cardIndex: card };
}
