import type { EmblaCarouselType } from "embla-carousel";
import type { PreviewDeckWithTarget } from "./preview-data";

/** One lap around the card border trace (ms). */
export const CARD_PLAY_LAP_DURATION_MS = 900;
/** Laps required before a held card becomes armed. */
export const CARD_PLAY_LAPS = 2;
export const CARD_PLAY_TRAIL_DURATION_MS = CARD_PLAY_LAP_DURATION_MS * CARD_PLAY_LAPS;
export const CARD_PUSH_RECEIPT_DURATION_MS = 2400;
export const CARD_PLAY_TRACE_PATH =
  "M 50 1 L 93 1 A 6 6 0 0 1 99 7 L 99 93 A 6 6 0 0 1 93 99 L 7 99 A 6 6 0 0 1 1 93 L 1 7 A 6 6 0 0 1 7 1 L 50 1";

export function cardChatMessage(
  deckName: string,
  targetPaneLabel: string,
  card: PreviewDeckWithTarget["cards"][number],
): string {
  const preview =
    card.preview?.kind === "figlet"
      ? ` Render the result as figlet using the "${card.preview.value}" font.`
      : card.preview?.kind === "oneline"
        ? ` Include this one-line ASCII artifact: ${card.preview.value}`
        : "";
  return `POWERFIST STACK PUSH // "${card.title}" from "${deckName}" against ${targetPaneLabel}. ${card.purpose}${preview}`;
}

export function cardNeedsComposer(card: { toolOverride?: { composerArg?: string } }): boolean {
  return Boolean(card.toolOverride?.composerArg);
}

export function attachMatrixGrabCursor(embla: EmblaCarouselType, viewport: HTMLElement) {
  const onDown = () => viewport.classList.add("is-grabbing");
  const onUp = () => viewport.classList.remove("is-grabbing");
  embla.on("pointerDown", onDown);
  embla.on("pointerUp", onUp);
}

export function composerPlaceholderForArg(arg: string): string {
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
