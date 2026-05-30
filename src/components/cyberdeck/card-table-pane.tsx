"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { EXECUTION_CARD_REGISTRY, EXECUTION_HANDS, getHandCards, type ExecutionCard } from "@/lib/computer-use/execution-card-registry";
import { useDeckMode } from "@/lib/deck-mode";
import {
  LEGACY_ACTION_DANGER,
  LEGACY_ACTION_NEUTRAL,
  realmorphismActionClass,
  realmorphismControlClass,
  realmorphismFilterClass,
} from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

type CardTablePaneProps = {
  activeHand: string | null;
  stagedCardCount: number;
  stackDepth: number;
  executionEnabled: boolean;
  topStackCard: { title: string; status: string; riskLevel: string } | null;
  stackCards: Array<{ title: string; status: string; riskLevel: string }>;
  stagedCards: Array<{ title: string; purpose: string; riskLevel: string; status: string; requiredConfirmation: boolean }>;
  onPushHandToStack: () => void;
  onClearDeck: () => void;
  onExecute: () => void;
  onClose: () => void;
  onSelectHand: (handId: string) => void;
  onStageCard: (cardId: string) => void;
  selectedCardIds: string[];
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

const RISK_BORDER: Record<string, string> = {
  safe: "border-[#22c55e]/30",
  caution: "border-[#f59e0b]/30",
  restricted: "border-[#ef4444]/30",
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

function ExecutionCardTile({
  card,
  isSelected,
  onClick,
}: {
  card: ExecutionCard;
  isSelected: boolean;
  onClick: () => void;
}) {
  const deckMode = useDeckMode();
  const riskColor = RISK_COLORS[card.risk] ?? "#8a8a8a";
  const categoryColor = CATEGORY_COLORS[card.category] ?? "#8a8a8a";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        realmorphismControlClass(deckMode, {
          size: "tile",
          signal: isSelected,
          legacyClassName: isSelected
            ? "group relative w-full rounded-sm border bg-black p-2 text-left transition-all border-[#22c55e]/60 bg-[#22c55e]/5"
            : "group relative w-full rounded-sm border bg-black p-2 text-left transition-all border-[#1c1c1c] hover:border-[#3a3a3a]",
        }),
        card.risk === "restricted" && !isSelected && "border-[#ef4444]/20",
        !card.enabled && "opacity-50",
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-1">
        <span className="font-mono text-[9px] tracking-[0.06em]" style={{ color: categoryColor }}>
          {card.category.toUpperCase()}
        </span>
        <span className="font-mono text-[8px] tracking-[0.04em]" style={{ color: riskColor }}>
          {RISK_LABELS[card.risk]}
        </span>
      </div>
      <div className="font-mono text-[10px] text-[#cfcfcf] leading-tight">{card.name}</div>
      <div className="mt-1 truncate font-mono text-[8px] text-[#6a6a6a]">{card.description}</div>
      {card.requiresConfirmation && (
        <div className="mt-1 font-mono text-[7px] tracking-[0.04em] text-amber-500">CONFIRM</div>
      )}
      {isSelected && (
        <div className="absolute -top-[2px] -right-[2px] flex h-3 w-3 items-center justify-center rounded-full bg-[#22c55e]">
          <span className="text-[6px] text-black">✓</span>
        </div>
      )}
    </button>
  );
}

function HandSelector({
  hands,
  activeHandId,
  onSelect,
}: {
  hands: typeof EXECUTION_HANDS;
  activeHandId: string | null;
  onSelect: (handId: string) => void;
}) {
  const deckMode = useDeckMode();

  return (
    <div className="flex flex-wrap gap-1">
      {hands.map((hand) => {
        const isActive = hand.id === activeHandId;
        return (
          <button
            key={hand.id}
            type="button"
            onClick={() => onSelect(hand.id)}
            aria-pressed={isActive}
            className={realmorphismFilterClass(deckMode, isActive, "signal")}
          >
            {hand.name}
          </button>
        );
      })}
    </div>
  );
}

function StagedCardRow({
  card,
  onRemove,
}: {
  card: { title: string; riskLevel: string; requiredConfirmation: boolean };
  onRemove: () => void;
}) {
  const riskColor = RISK_COLORS[card.riskLevel as keyof typeof RISK_COLORS] ?? "#8a8a8a";

  return (
    <div className="flex items-center gap-2 border-b border-[#141414] pb-1 last:border-0 last:pb-0">
      <button
        type="button"
        onClick={onRemove}
        className="font-mono text-[9px] text-[#4a4a4a] hover:text-red-400"
      >
        ✕
      </button>
      <span className="font-mono text-[10px] text-[#cfcfcf]">{card.title}</span>
      {card.requiredConfirmation && (
        <span className="font-mono text-[8px] tracking-[0.04em] text-amber-500">CONF</span>
      )}
      <span className="ml-auto font-mono text-[8px] tracking-[0.04em]" style={{ color: riskColor }}>
        {card.riskLevel.toUpperCase()}
      </span>
    </div>
  );
}

export function CardTablePane({
  activeHand,
  stagedCardCount,
  stackDepth,
  executionEnabled,
  topStackCard,
  stackCards,
  stagedCards,
  onPushHandToStack,
  onClearDeck,
  onExecute,
  onClose,
  onSelectHand,
  onStageCard,
  selectedCardIds,
}: CardTablePaneProps) {
  const deckMode = useDeckMode();
  const hasStack = stackDepth > 0;
  const hasStaged = selectedCardIds.length > 0 || stagedCardCount > 0;
  const canPush = hasStaged && !hasStack;
  const canExecute = hasStack;
  const cards = Object.values(EXECUTION_CARD_REGISTRY);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                CARD TABLE
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                {activeHand ? `HAND: ${activeHand}` : "SELECT A HAND"}
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <button
              type="button"
              onClick={onClose}
              className={realmorphismActionClass(deckMode, "danger")}
            >
              CLOSE
            </button>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          <div className="flex gap-2 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
            <div className="flex flex-col gap-1">
              <CyberdeckPaneHeaderValue>STAGED</CyberdeckPaneHeaderValue>
              <span className="font-mono text-[12px] text-[#cfcfcf]">{selectedCardIds.length}</span>
            </div>
            <div className="h-full w-px bg-[#1c1c1c]" />
            <div className="flex flex-col gap-1">
              <CyberdeckPaneHeaderValue>STACK</CyberdeckPaneHeaderValue>
              <span className="font-mono text-[12px] text-[#cfcfcf]">{stackDepth}</span>
            </div>
            <div className="h-full w-px bg-[#1c1c1c]" />
            <div className="flex flex-col gap-1">
              <CyberdeckPaneHeaderValue>EXEC</CyberdeckPaneHeaderValue>
              <span
                className="font-mono text-[12px]"
                style={{ color: executionEnabled ? "#22c55e" : "#ef4444" }}
              >
                {executionEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <div className="h-full w-px bg-[#1c1c1c]" />
            <div className="flex flex-col gap-1">
              <CyberdeckPaneHeaderValue>CARDS</CyberdeckPaneHeaderValue>
              <span className="font-mono text-[12px] text-[#cfcfcf]">{cards.length}</span>
            </div>
          </div>

          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
            <div className="mb-2 text-[9px] tracking-[0.08em] text-[#6a6a6a]">HANDS</div>
            <HandSelector
              hands={EXECUTION_HANDS}
              activeHandId={activeHand}
              onSelect={onSelectHand}
            />
          </div>

          {selectedCardIds.length > 0 && (
            <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] tracking-[0.08em] text-[#6a6a6a]">STAGED PLAY</span>
                <button
                  type="button"
                  onClick={() => selectedCardIds.forEach(id => onStageCard(id))}
                  className="font-mono text-[8px] text-[#4a4a4a] hover:text-red-400"
                >
                  CLEAR ALL
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {cards
                  .filter((c) => selectedCardIds.includes(c.id))
                  .map((card) => (
                    <StagedCardRow
                      key={card.id}
                      card={{
                        title: card.name,
                        riskLevel: card.risk,
                        requiredConfirmation: card.requiresConfirmation,
                      }}
                      onRemove={() => onStageCard(card.id)}
                    />
                  ))}
              </div>
            </div>
          )}

          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
            <div className="mb-2 text-[9px] tracking-[0.08em] text-[#6a6a6a]">TACTICAL CARDS</div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {cards.map((card) => (
                <ExecutionCardTile
                  key={card.id}
                  card={card}
                  isSelected={selectedCardIds.includes(card.id)}
                  onClick={() => onStageCard(card.id)}
                />
              ))}
            </div>
          </div>

          {hasStack && (
            <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
              <div className="mb-2 text-[9px] tracking-[0.08em] text-[#6a6a6a]">
                EXECUTION STACK ({stackDepth})
              </div>
              <div className="flex flex-col gap-0">
                {stackCards.map((card, idx) => (
                  <div key={card.title} className="flex items-center gap-2 py-1">
                    <span className={`font-mono text-[9px] ${idx === 0 ? "text-green-400" : "text-[#3a3a3a]"}`}>
                      {idx === 0 ? "▶" : "·"}
                    </span>
                    <span className="font-mono text-[9px] tracking-[0.06em] text-[#8a8a8a]">
                      [{card.status.toUpperCase()}]
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#cfcfcf]">
                      {card.title}
                    </span>
                    <span
                      className="font-mono text-[9px] tracking-[0.06em]"
                      style={{ color: RISK_COLORS[card.riskLevel as keyof typeof RISK_COLORS] ?? "#8a8a8a" }}
                    >
                      {card.riskLevel.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topStackCard && (
            <div className="rounded-sm border border-green-900/40 bg-black/80 p-2">
              <div className="mb-1 text-[9px] tracking-[0.08em] text-[#6a6a6a]">TOP OF STACK</div>
              <div className="font-mono text-[10px] text-[#22c55e]">{topStackCard.title}</div>
              <div className="font-mono text-[9px] text-[#6a6a6a]">
                {topStackCard.status.toUpperCase()} · {topStackCard.riskLevel.toUpperCase()} RISK
              </div>
            </div>
          )}

          {!hasStaged && !hasStack && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="font-mono text-[10px] text-[#6a6a6a]">DECK EMPTY</div>
              <div className="mt-1 font-mono text-[9px] text-[#4a4a4a]">
                Select a hand or click cards to stage
              </div>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPushHandToStack}
                disabled={!canPush}
                className={realmorphismControlClass(deckMode, {
                  size: "wide",
                  off: !canPush,
                  legacyClassName: canPush
                    ? LEGACY_ACTION_NEUTRAL
                    : "cursor-not-allowed rounded border border-[#141414] bg-black/50 px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-[#3a3a3a]",
                })}
              >
                PUSH TO STACK
              </button>
              <button
                type="button"
                onClick={onClearDeck}
                disabled={!hasStaged && !hasStack}
                className={realmorphismControlClass(deckMode, {
                  size: "wide",
                  danger: hasStaged || hasStack,
                  off: !hasStaged && !hasStack,
                  legacyClassName:
                    hasStaged || hasStack
                      ? LEGACY_ACTION_DANGER
                      : "cursor-not-allowed rounded border border-[#141414] bg-black/50 px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-[#3a3a3a]",
                })}
              >
                CLEAR DECK
              </button>
            </div>
            <button
              type="button"
              onClick={onExecute}
              disabled={!canExecute}
              className={realmorphismControlClass(deckMode, {
                size: "wide",
                amber: canExecute,
                off: !canExecute,
                legacyClassName: canExecute
                  ? "w-full rounded border border-[#2d2d2d] bg-black px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-amber-500/60 hover:text-amber-200"
                  : "w-full cursor-not-allowed rounded border border-[#141414] bg-black/50 px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-[#3a3a3a]",
              })}
            >
              EXECUTE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}