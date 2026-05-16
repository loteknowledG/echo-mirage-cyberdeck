export type CardStatus = "staged" | "stacked" | "blocked" | "running" | "complete" | "failed" | "skipped";
export type RiskLevel = "low" | "medium" | "high";

export interface ExecutionCard {
  id: string;
  title: string;
  purpose: string;
  riskLevel: RiskLevel;
  requiredConfirmation: boolean;
  status: CardStatus;
  inputsSummary: string;
  outputsSummary: string;
  scriptName?: string;
  createdAt: string;
  updatedAt: string;
  lastResult?: string;
}

export interface ExecutionHand {
  name: string;
  cards: ExecutionCard[];
  createdAt: string;
}

export interface CardTableState {
  stagedHand: ExecutionHand | null;
  executionStack: ExecutionCard[];
  currentCard: ExecutionCard | null;
  lastResult: string | null;
  openedAt: string | null;
  executionEnabled: boolean;
  activeHand: string | null;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const state: CardTableState = {
  stagedHand: null,
  executionStack: [],
  currentCard: null,
  lastResult: null,
  openedAt: null,
  executionEnabled: false,
  activeHand: null,
};

function touch(card: ExecutionCard): void {
  card.updatedAt = new Date().toISOString();
}

export function getCardTableState(): CardTableState {
  return {
    stagedHand: state.stagedHand ? { ...state.stagedHand, cards: [...state.stagedHand.cards] } : null,
    executionStack: [...state.executionStack],
    currentCard: state.currentCard,
    lastResult: state.lastResult,
    openedAt: state.openedAt,
    executionEnabled: state.executionEnabled,
    activeHand: state.activeHand,
  };
}

export function isDeckOpen(): boolean {
  return state.openedAt !== null;
}

export function openDeck(): CardTableState {
  state.openedAt = state.openedAt ?? new Date().toISOString();
  return getCardTableState();
}

export function closeDeck(): CardTableState {
  state.openedAt = null;
  return getCardTableState();
}

export function prepareHand(name: string, cards: ExecutionCard[]): ExecutionHand {
  const hand: ExecutionHand = {
    name,
    cards,
    createdAt: new Date().toISOString(),
  };
  state.stagedHand = hand;
  state.executionStack = [];
  state.currentCard = null;
  state.lastResult = null;
  state.activeHand = name;
  if (!state.openedAt) state.openedAt = new Date().toISOString();
  return hand;
}

export function pushHandToStack(): { pushed: number; stackDepth: number } {
  if (!state.stagedHand || state.stagedHand.cards.length === 0) {
    return { pushed: 0, stackDepth: state.executionStack.length };
  }
  const cards = state.stagedHand.cards.map((c) => {
    const updated = { ...c, status: "stacked" as CardStatus };
    touch(updated);
    return updated;
  });
  state.executionStack.push(...cards);
  state.currentCard = state.executionStack[0] ?? null;
  state.stagedHand = null;
  state.lastResult = null;
  return { pushed: cards.length, stackDepth: state.executionStack.length };
}

export function attemptExecute(): { success: boolean; reason: string } {
  if (!state.executionEnabled) {
    return { success: false, reason: "Execution disabled in v0.1" };
  }
  if (state.executionStack.length === 0) {
    return { success: false, reason: "Stack is empty" };
  }
  return { success: false, reason: "Execution disabled in v0.1" };
}

export function isExecutionEnabled(): boolean {
  return state.executionEnabled;
}

export function getTopStackCard(): ExecutionCard | null {
  return state.executionStack[0] ?? null;
}

export function getStackCards(): readonly ExecutionCard[] {
  return [...state.executionStack];
}

export function getCurrentStatuses(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const card of state.executionStack) {
    result[card.id] = card.status;
  }
  return result;
}

export function stageCard(card: ExecutionCard): ExecutionCard {
  if (!state.stagedHand) {
    state.stagedHand = {
      name: "Staged Hand",
      cards: [],
      createdAt: new Date().toISOString(),
    };
  }
  if (!state.openedAt) state.openedAt = new Date().toISOString();
  const staged = { ...card, id: makeId("card"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.stagedHand.cards.push(staged);
  state.executionStack.push(staged);
  return staged;
}

export function removeCard(cardId: string): boolean {
  let removed = false;
  if (state.stagedHand) {
    const before = state.stagedHand.cards.length;
    state.stagedHand.cards = state.stagedHand.cards.filter((c) => c.id !== cardId);
    removed = state.stagedHand.cards.length < before;
  }
  if (!removed) {
    const before = state.executionStack.length;
    state.executionStack = state.executionStack.filter((c) => c.id !== cardId);
    removed = state.executionStack.length < before;
  }
  if (removed) {
    if (state.currentCard?.id === cardId) {
      state.currentCard = state.executionStack[0] ?? null;
    }
  }
  return removed;
}

export function clearDeck(): CardTableState {
  if (state.stagedHand) {
    for (const card of state.stagedHand.cards) {
      card.status = "skipped";
      touch(card);
    }
  }
  for (const card of state.executionStack) {
    card.status = "skipped";
    touch(card);
  }
  state.stagedHand = null;
  state.executionStack = [];
  state.currentCard = null;
  state.lastResult = null;
  state.activeHand = null;
  return getCardTableState();
}

export function updateCardStatus(cardId: string, status: CardStatus, result?: string): boolean {
  const card = state.executionStack.find((c) => c.id === cardId);
  if (!card) return false;
  card.status = status;
  touch(card);
  if (result !== undefined) card.lastResult = result;
  if (status === "running") {
    state.currentCard = card;
  } else if (state.currentCard?.id === cardId) {
    state.currentCard = state.executionStack.find((c) => c.status === "running") ?? null;
  }
  return true;
}

export function getStackDepth(): number {
  return state.executionStack.length;
}

export function getStagedCardCount(): number {
  return state.stagedHand?.cards.length ?? 0;
}

export function prepareHandFromRegistry(handName: string, registryCards: Array<{ id: string; name: string; description: string; risk: string; requiresConfirmation: boolean }>): ExecutionHand {
  const now = new Date().toISOString();
  const cards: ExecutionCard[] = registryCards.map((rc) => ({
    id: makeId("card"),
    title: rc.name,
    purpose: rc.description,
    riskLevel: rc.risk === "safe" ? "low" : rc.risk === "caution" ? "medium" : "high",
    requiredConfirmation: rc.requiresConfirmation,
    status: "staged",
    inputsSummary: "",
    outputsSummary: "",
    createdAt: now,
    updatedAt: now,
  }));
  const hand: ExecutionHand = {
    name: handName,
    cards,
    createdAt: now,
  };
  state.stagedHand = hand;
  state.executionStack = [];
  state.currentCard = null;
  state.lastResult = null;
  state.activeHand = handName;
  if (!state.openedAt) state.openedAt = new Date().toISOString();
  return hand;
}

export function syncStagedHandFromSelectedIds(selectedCardIds: string[], registryCards: Record<string, { name: string; description: string; risk: string; requiresConfirmation: boolean }>): ExecutionHand {
  const now = new Date().toISOString();
  const cards: ExecutionCard[] = selectedCardIds.map((id) => {
    const rc = registryCards[id];
    return {
      id: makeId("card"),
      title: rc?.name ?? id,
      purpose: rc?.description ?? "",
      riskLevel: (rc?.risk === "safe" ? "low" : rc?.risk === "caution" ? "medium" : "high") as RiskLevel,
      requiredConfirmation: rc?.requiresConfirmation ?? false,
      status: "staged" as CardStatus,
      inputsSummary: "",
      outputsSummary: "",
      createdAt: now,
      updatedAt: now,
    };
  });
  const hand: ExecutionHand = {
    name: "Selected Cards",
    cards,
    createdAt: now,
  };
  state.stagedHand = hand;
  state.activeHand = "Selected Cards";
  if (!state.openedAt) state.openedAt = new Date().toISOString();
  return hand;
}

export function describeDeck(): string {
  const deck = getCardTableState();
  const lines: string[] = [];
  lines.push(`=== EXECUTION DECK ===`);
  lines.push(`Active hand: ${deck.activeHand ?? "(none)"}`);
  lines.push(`Cards staged: ${deck.stagedHand?.cards.length ?? 0}`);
  lines.push(`Stack depth: ${deck.executionStack.length}`);
  lines.push(`Execution: ${deck.executionEnabled ? "ENABLED" : "DISABLED"}`);
  if (!deck.stagedHand && deck.executionStack.length === 0) {
    lines.push("Deck: empty");
  }
  lines.push("");

  if (deck.stagedHand && deck.stagedHand.cards.length > 0) {
    lines.push("## Staged Hand");
    lines.push(`  ${deck.stagedHand.name} — ${deck.stagedHand.cards.length} card(s)`);
    for (const card of deck.stagedHand.cards) {
      lines.push(`    [ ] ${card.title} (${card.riskLevel} risk) — ${card.purpose}`);
    }
    lines.push("");
  }

  if (deck.executionStack.length > 0) {
    lines.push(`## Stack (${deck.executionStack.length} card(s))`);
    deck.executionStack.forEach((card, idx) => {
      const topMarker = idx === 0 ? ">>>" : "   ";
      const statusMarker = card.status === "stacked" ? "[S]" : card.status === "blocked" ? "[B]" : card.status === "running" ? "[R]" : card.status === "complete" ? "[OK]" : card.status === "failed" ? "[FL]" : card.status === "skipped" ? "[SK]" : "[?]";
      lines.push(`  ${topMarker} ${statusMarker} ${card.title} (${card.riskLevel})`);
    });
    lines.push("");
  }

  if (deck.currentCard) {
    lines.push(`## Top of Stack`);
    lines.push(`  ${deck.currentCard.title} [${deck.currentCard.status}]`);
    lines.push("");
  }

  if (deck.lastResult) {
    lines.push(`## Last Result`);
    lines.push(`  ${deck.lastResult}`);
  }

  return lines.join("\n");
}

export function buildReviewerHand(): ExecutionCard[] {
  const now = new Date().toISOString();
  return [
    {
      id: makeId("card"),
      title: "Capture Builder Result",
      purpose: "Package the current build output into a structured artifact for review.",
      riskLevel: "low",
      requiredConfirmation: true,
      status: "staged",
      inputsSummary: "Build artifacts, routes count, type errors",
      outputsSummary: "Captured build result document",
      scriptName: "capture-build-result",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("card"),
      title: "Request Codex Review",
      purpose: "Present the current state to an AI reviewer for assessment.",
      riskLevel: "medium",
      requiredConfirmation: true,
      status: "staged",
      inputsSummary: "Current file state, changed files, git diff",
      outputsSummary: "Review assessment summary",
      scriptName: "request-codex-review",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("card"),
      title: "Summarize Review",
      purpose: "Condense review findings into executive summary format.",
      riskLevel: "low",
      requiredConfirmation: false,
      status: "staged",
      inputsSummary: "Review output, artifact references",
      outputsSummary: "Summary document",
      scriptName: "summarize-review",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("card"),
      title: "Archive Outcome",
      purpose: "Commit the current session state to the operational archive.",
      riskLevel: "low",
      requiredConfirmation: true,
      status: "staged",
      inputsSummary: "Session state, deck contents, timestamp",
      outputsSummary: "Archived session record",
      scriptName: "archive-outcome",
      createdAt: now,
      updatedAt: now,
    },
  ];
}