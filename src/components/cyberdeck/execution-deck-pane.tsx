"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";

type ExecutionDeckPaneProps = {
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
};

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  staged: "#8a8a8a",
  stacked: "#22c55e",
  blocked: "#ef4444",
  running: "#f59e0b",
  complete: "#22c55e",
  failed: "#ef4444",
  skipped: "#6a6a6a",
};

const STATUS_LABELS: Record<string, string> = {
  staged: "STAGED",
  stacked: "STACKED",
  blocked: "BLOCKED",
  running: "RUNNING",
  complete: "OK",
  failed: "FL",
  skipped: "SK",
};

function CardRow({
  title,
  status,
  riskLevel,
  isTop = false,
}: {
  title: string;
  status: string;
  riskLevel: string;
  isTop?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      {isTop ? (
        <span className="font-mono text-[9px] text-green-400">▶</span>
      ) : (
        <span className="font-mono text-[9px] text-[#3a3a3a]">·</span>
      )}
      <span className="font-mono text-[9px] tracking-[0.06em]" style={{ color: STATUS_COLORS[status] ?? "#8a8a8a" }}>
        [{STATUS_LABELS[status] ?? status.toUpperCase()}]
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#cfcfcf]">{title}</span>
      <span className="font-mono text-[9px] tracking-[0.06em]" style={{ color: RISK_COLORS[riskLevel] ?? "#8a8a8a" }}>
        {riskLevel.toUpperCase()}
      </span>
    </div>
  );
}

export function ExecutionDeckPane({
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
}: ExecutionDeckPaneProps) {
  const hasStack = stackDepth > 0;
  const hasStaged = stagedCardCount > 0;
  const canPush = hasStaged && !hasStack;
  const canExecute = hasStack;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                EXECUTION DECK
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                {activeHand ?? "NO ACTIVE HAND"} // DOMAIN → GAME → DECK
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-red-500/60 hover:text-red-200"
            >
              CLOSE
            </button>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          <div className="flex gap-2 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
            <div className="flex flex-col gap-1">
              <CyberdeckPaneHeaderValue>STAGED</CyberdeckPaneHeaderValue>
              <span className="font-mono text-[12px] text-[#cfcfcf]">{stagedCardCount}</span>
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
          </div>

          {stagedCards.length > 0 ? (
            <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
              <div className="mb-2 text-[9px] tracking-[0.08em] text-[#6a6a6a]">STAGED HAND</div>
              <div className="flex flex-col gap-1">
                {stagedCards.map((card) => (
                  <div key={card.title} className="flex flex-col gap-[2px] border-b border-[#141414] pb-1 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#4a4a4a]">[ ]</span>
                      <span className="font-mono text-[10px] text-[#cfcfcf]">{card.title}</span>
                      {card.requiredConfirmation ? (
                        <span className="font-mono text-[9px] tracking-[0.06em] text-amber-500">CONF</span>
                      ) : null}
                      <span className="ml-auto font-mono text-[9px] tracking-[0.06em]" style={{ color: RISK_COLORS[card.riskLevel] }}>
                        {card.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <div className="pl-4 font-mono text-[9px] text-[#6a6a6a]">{card.purpose}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasStack ? (
            <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
              <div className="mb-2 text-[9px] tracking-[0.08em] text-[#6a6a6a]">
                EXECUTION STACK ({stackDepth})
              </div>
              <div className="flex flex-col gap-0">
                {stackCards.map((card, idx) => (
                  <CardRow
                    key={card.title}
                    title={card.title}
                    status={card.status}
                    riskLevel={card.riskLevel}
                    isTop={idx === 0}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {topStackCard ? (
            <div className="rounded-sm border border-green-900/40 bg-black/80 p-2">
              <div className="mb-1 text-[9px] tracking-[0.08em] text-[#6a6a6a]">TOP OF STACK</div>
              <div className="font-mono text-[10px] text-[#22c55e]">{topStackCard.title}</div>
              <div className="font-mono text-[9px] text-[#6a6a6a]">
                {topStackCard.status.toUpperCase()} · {topStackCard.riskLevel.toUpperCase()} RISK
              </div>
            </div>
          ) : null}

          {!hasStaged && !hasStack ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="font-mono text-[10px] text-[#6a6a6a]">DECK EMPTY</div>
              <div className="mt-1 font-mono text-[9px] text-[#4a4a4a]">
                Ask MUTHUR to prepare a hand
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPushHandToStack}
                disabled={!canPush}
                className={`flex-1 rounded border px-3 py-2 font-mono text-[9px] tracking-[0.08em] transition ${
                  canPush
                    ? "border-[#2d2d2d] bg-black text-[#8a8a8a] hover:border-emerald-500/60 hover:text-emerald-200"
                    : "cursor-not-allowed border-[#141414] bg-black/50 text-[#3a3a3a]"
                }`}
              >
                PUSH HAND TO STACK
              </button>
              <button
                type="button"
                onClick={onClearDeck}
                disabled={!hasStaged && !hasStack}
                className={`flex-1 rounded border px-3 py-2 font-mono text-[9px] tracking-[0.08em] transition ${
                  hasStaged || hasStack
                    ? "border-[#2d2d2d] bg-black text-[#8a8a8a] hover:border-red-500/60 hover:text-red-200"
                    : "cursor-not-allowed border-[#141414] bg-black/50 text-[#3a3a3a]"
                }`}
              >
                CLEAR DECK
              </button>
            </div>
            <button
              type="button"
              onClick={onExecute}
              disabled={!canExecute}
              className={`w-full rounded border px-3 py-2 font-mono text-[9px] tracking-[0.08em] transition ${
                canExecute
                  ? "border-[#2d2d2d] bg-black text-[#8a8a8a] hover:border-amber-500/60 hover:text-amber-200"
                  : "cursor-not-allowed border-[#141414] bg-black/50 text-[#3a3a3a]"
              }`}
            >
              EXECUTE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}