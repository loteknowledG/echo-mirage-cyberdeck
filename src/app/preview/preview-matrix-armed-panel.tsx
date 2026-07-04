"use client";

import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import type { PreviewDeckWithTarget } from "./preview-data";
import {
  CARD_PLAY_TRACE_PATH,
  cardNeedsComposer,
  composerPlaceholderForArg,
} from "./preview-matrix-play";
import type { ArmedPanelArmingMode } from "./use-preview-matrix-card-play";

type ArmedCard = {
  card: PreviewDeckWithTarget["cards"][number];
  cardIndex: number;
  deck: PreviewDeckWithTarget;
  deckIndex: number;
};

type PreviewMatrixArmedPanelProps = {
  armedCard: ArmedCard;
  armedPanelArming: ArmedPanelArmingMode | null;
  armedPanelTraceKey: number;
  composerText: string;
  onCancelArmedPanelHold: () => void;
  onArmedPanelPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onArmedPanelPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onComposerTextChange: (value: string) => void;
  onPushCard: (deckIndex: number, cardIndex: number) => void;
  onResetCardPlay: () => void;
};

export function PreviewMatrixArmedPanel({
  armedCard,
  armedPanelArming,
  armedPanelTraceKey,
  composerText,
  onCancelArmedPanelHold,
  onArmedPanelPointerDown,
  onArmedPanelPointerMove,
  onComposerTextChange,
  onPushCard,
  onResetCardPlay,
}: PreviewMatrixArmedPanelProps) {
  return (
    <section
      className={`cardOpenViewport${armedPanelArming === "push" ? " is-arming-push" : ""}${armedPanelArming === "cancel" ? " is-arming-cancel" : ""}`}
      data-testid="powerfist-open-card"
      onPointerDown={onArmedPanelPointerDown}
      onPointerMove={onArmedPanelPointerMove}
      onPointerUp={onCancelArmedPanelHold}
      onPointerCancel={onCancelArmedPanelHold}
    >
      {armedPanelArming ? (
        <svg
          aria-hidden
          className={`cardPlayTrace cardOpenViewportTrace${armedPanelArming === "cancel" ? " is-cancel" : ""}`}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <path
            key={armedPanelTraceKey}
            className={`cardPlayTracePath${armedPanelArming === "cancel" ? " is-reverse" : ""}`}
            d={CARD_PLAY_TRACE_PATH}
            pathLength="1"
          />
        </svg>
      ) : null}
      <div className="cardOpenViewportHeader">
        <div>
          <div className="cardArmedPanelStatus">
            <span
              className={`cardArmedPanelDot${armedPanelArming === "cancel" ? " is-cancel" : ""}`}
              aria-hidden
            />
            {armedPanelArming === "cancel"
              ? "Disarming // Red reverse ×2"
              : armedPanelArming === "push"
                ? "Arming push // Trace ×2"
                : "Prepared // Locked"}
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
              onChange={(event) => onComposerTextChange(event.target.value)}
              placeholder={composerPlaceholderForArg(
                armedCard.card.toolOverride?.composerArg ?? "",
              )}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onPushCard(armedCard.deckIndex, armedCard.cardIndex);
                onResetCardPlay();
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="cardOpenViewportGestureHint">
        Hold panel — clockwise trace ×2 to push · counter-clockwise red ×2 to cancel
      </p>
      <div className="cardOpenViewportActions">
        <button type="button" className="cardClose" onClick={onResetCardPlay}>
          Close
        </button>
        <button
          type="button"
          className="push"
          onClick={() => {
            onPushCard(armedCard.deckIndex, armedCard.cardIndex);
            onResetCardPlay();
          }}
        >
          Push
        </button>
      </div>
    </section>
  );
}
