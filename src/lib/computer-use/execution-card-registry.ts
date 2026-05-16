export type CardRisk = "safe" | "caution" | "restricted";

export type CardCategory =
  | "review"
  | "capture"
  | "runtime"
  | "memory"
  | "surface"
  | "teaching"
  | "recovery"
  | "system";

export type ExecutionCard = {
  id: string;
  name: string;
  description: string;
  category: CardCategory;
  risk: CardRisk;
  tags: string[];
  enabled: boolean;
  requiresConfirmation: boolean;
  doctrineNotes?: string;
  inputs?: string[];
  outputs?: string[];
  aliases?: string[];
};

export type ExecutionCardRegistry = Record<string, ExecutionCard>;

export type ExecutionHand = {
  id: string;
  name: string;
  description: string;
  cards: string[];
};

function makeCard(partial: Omit<ExecutionCard, "id"> & { id?: string }): ExecutionCard {
  return {
    id: partial.id ?? "",
    name: partial.name,
    description: partial.description,
    category: partial.category,
    risk: partial.risk,
    tags: partial.tags,
    enabled: partial.enabled,
    requiresConfirmation: partial.requiresConfirmation,
    doctrineNotes: partial.doctrineNotes,
    inputs: partial.inputs,
    outputs: partial.outputs,
    aliases: partial.aliases,
  } as ExecutionCard;
}

const CAPTURE_LAST_CHATGPT_RESPONSE = makeCard({
  id: "capture_last_chatgpt_response",
  name: "Capture Last ChatGPT Response",
  description: "Package the most recent ChatGPT response as a structured artifact for review or archival.",
  category: "capture",
  risk: "safe",
  tags: ["chatgpt", "capture", "response", "artifact"],
  enabled: true,
  requiresConfirmation: false,
  doctrineNotes: "Non-destructive capture. Does not modify the source.",
  inputs: ["chat history", "latest assistant message"],
  outputs: ["captured response document"],
  aliases: ["copy last response", "copy chatgpt response", "capture response", "save last response", "archive chatgpt reply"],
});

const CAPTURE_BUILDER_RESULT = makeCard({
  id: "capture_builder_result",
  name: "Capture Builder Result",
  description: "Package the current build output into a structured artifact for review.",
  category: "capture",
  risk: "safe",
  tags: ["build", "capture", "artifact", "compile"],
  enabled: true,
  requiresConfirmation: true,
  doctrineNotes: "Capture build state. May require confirmation due to build artifact size.",
  inputs: ["build artifacts", "routes count", "type errors"],
  outputs: ["captured build result document"],
  aliases: ["capture build result", "save build output", "package build"],
});

const CAPTURE_REVIEW_RESULT = makeCard({
  id: "capture_review_result",
  name: "Capture Review Result",
  description: "Package the current review output into a structured artifact.",
  category: "capture",
  risk: "safe",
  tags: ["review", "capture", "artifact"],
  enabled: true,
  requiresConfirmation: false,
  inputs: ["review output", "codex assessment"],
  outputs: ["captured review document"],
  aliases: ["capture review", "save review", "package review result"],
});

const REQUEST_CODEX_REVIEW = makeCard({
  id: "request_codex_review",
  name: "Request Codex Review",
  description: "Present the current state to an AI reviewer for assessment.",
  category: "review",
  risk: "caution",
  tags: ["codex", "review", "assessment", "ai"],
  enabled: true,
  requiresConfirmation: true,
  doctrineNotes: "Medium risk. Triggers external AI assessment. May expose source to external model.",
  inputs: ["current file state", "changed files", "git diff"],
  outputs: ["review assessment summary"],
  aliases: ["request review", "codex review", "ai review", "review codex", "ask for review"],
});

const SUMMARIZE_REVIEW = makeCard({
  id: "summarize_review",
  name: "Summarize Review",
  description: "Condense review findings into executive summary format.",
  category: "review",
  risk: "safe",
  tags: ["review", "summary", "condense"],
  enabled: true,
  requiresConfirmation: false,
  inputs: ["review output", "artifact references"],
  outputs: ["summary document"],
  aliases: ["summarize", "condense review", "brief review", "review summary"],
});

const ESCALATE_TO_LEAD = makeCard({
  id: "escalate_to_lead",
  name: "Escalate to Lead",
  description: "Escalate the current workflow to lead operator for guidance.",
  category: "review",
  risk: "caution",
  tags: ["escalate", "lead", "review", "assistance"],
  enabled: true,
  requiresConfirmation: true,
  doctrineNotes: "Escalation may pause current workflow. Use when automated review is insufficient.",
  inputs: ["current state", "review findings"],
  outputs: ["escalation notice"],
  aliases: ["escalate", "get help", "call lead", "escalate to operator"],
});

const HOLD_RUNTIME = makeCard({
  id: "hold_runtime",
  name: "Hold Runtime",
  description: "Pause the current execution stack. Retains state for inspection.",
  category: "runtime",
  risk: "safe",
  tags: ["runtime", "hold", "pause", "stack"],
  enabled: true,
  requiresConfirmation: false,
  doctrineNotes: "Non-destructive pause. Runtime state preserved.",
  inputs: ["current runtime state"],
  outputs: ["runtime checkpoint"],
  aliases: ["hold", "pause runtime", "pause execution", "stop execution for now"],
});

const CLEAR_RUNTIME = makeCard({
  id: "clear_runtime",
  name: "Clear Runtime",
  description: "Discard all staged cards from the current execution stack.",
  category: "runtime",
  risk: "caution",
  tags: ["runtime", "clear", "discard", "stack"],
  enabled: true,
  requiresConfirmation: true,
  doctrineNotes: "Caution. Clears all staged cards. Cannot be undone without re-staging.",
  inputs: ["staged cards"],
  outputs: [],
  aliases: ["clear", "discard cards", "clear stack", "empty runtime"],
});

const EMERGENCY_HALT = makeCard({
  id: "emergency_halt",
  name: "Emergency Halt",
  description: "Immediately halt all execution and teaching workflows. Resets indicators and pauses narration.",
  category: "runtime",
  risk: "restricted",
  tags: ["emergency", "halt", "stop", "safety"],
  enabled: true,
  requiresConfirmation: false,
  doctrineNotes: "Restricted. Immediately cancels streaming, teaching, indicators, and TTS. Operator retains control.",
  inputs: [],
  outputs: ["halt confirmation"],
  aliases: ["emergency stop", "halt", "stop everything", "emergency halt", "abort"],
});

const START_TEACHING_MODE = makeCard({
  id: "start_teaching_mode",
  name: "Start Teaching Mode",
  description: "Enter guided teaching mode with step-by-step workflow highlighting.",
  category: "teaching",
  risk: "safe",
  tags: ["teaching", "guided", "workflow", "demo"],
  enabled: true,
  requiresConfirmation: false,
  doctrineNotes: "Non-invasive teaching mode. Cursor presence drives workflow.",
  inputs: [],
  outputs: ["teaching mode active"],
  aliases: ["teach me", "start teaching", "guide me", "teaching demo", "start demo"],
});

const ACKNOWLEDGE_STEP = makeCard({
  id: "acknowledge_step",
  name: "Acknowledge Step",
  description: "Mark current teaching step as acknowledged and advance to next.",
  category: "teaching",
  risk: "safe",
  tags: ["teaching", "step", "acknowledge", "advance"],
  enabled: true,
  requiresConfirmation: false,
  inputs: ["current step marker"],
  outputs: ["step advanced"],
  aliases: ["acknowledge", "next step", "step acknowledged", "advance"],
});

const RETRY_BUILDER = makeCard({
  id: "retry_builder",
  name: "Retry Builder",
  description: "Re-run the last build command to capture fresh output.",
  category: "recovery",
  risk: "caution",
  tags: ["recovery", "build", "retry"],
  enabled: true,
  requiresConfirmation: true,
  doctrineNotes: "Caution. Re-triggers build process. May take time on large projects.",
  inputs: ["last build command"],
  outputs: ["new build result"],
  aliases: ["retry build", "rebuild", "try build again"],
});

const PREPARE_RECOVERY_HAND = makeCard({
  id: "prepare_recovery_hand",
  name: "Prepare Recovery Hand",
  description: "Stage a recovery hand with retry and escalation cards.",
  category: "recovery",
  risk: "safe",
  tags: ["recovery", "hand", "stage"],
  enabled: true,
  requiresConfirmation: false,
  doctrineNotes: "Stages recovery hand without executing. Use before retry operations.",
  inputs: [],
  outputs: ["recovery hand staged"],
  aliases: ["stage recovery", "prepare recovery", "recovery hand"],
});

const ARCHIVE_OUTCOME = makeCard({
  id: "archive_outcome",
  name: "Archive Outcome",
  description: "Commit the current session state to the operational archive.",
  category: "system",
  risk: "safe",
  tags: ["archive", "session", "memory"],
  enabled: true,
  requiresConfirmation: true,
  doctrineNotes: "Confirmation required. Archives full session state including deck contents.",
  inputs: ["session state", "deck contents", "timestamp"],
  outputs: ["archived session record"],
  aliases: ["archive", "save session", "archive session", "commit"],
});

const OPEN_EXECUTION_DECK = makeCard({
  id: "open_execution_deck",
  name: "Open Execution Deck",
  description: "Display the Execution Deck pane for tactical card operations.",
  category: "system",
  risk: "safe",
  tags: ["deck", "system", "display"],
  enabled: true,
  requiresConfirmation: false,
  inputs: [],
  outputs: ["deck displayed"],
  aliases: ["open deck", "show deck", "execution deck", "display deck"],
});

export const EXECUTION_CARD_REGISTRY: ExecutionCardRegistry = {
  "capture_last_chatgpt_response": CAPTURE_LAST_CHATGPT_RESPONSE,
  "capture_builder_result": CAPTURE_BUILDER_RESULT,
  "capture_review_result": CAPTURE_REVIEW_RESULT,
  "request_codex_review": REQUEST_CODEX_REVIEW,
  "summarize_review": SUMMARIZE_REVIEW,
  "escalate_to_lead": ESCALATE_TO_LEAD,
  "hold_runtime": HOLD_RUNTIME,
  "clear_runtime": CLEAR_RUNTIME,
  "emergency_halt": EMERGENCY_HALT,
  "start_teaching_mode": START_TEACHING_MODE,
  "acknowledge_step": ACKNOWLEDGE_STEP,
  "retry_builder": RETRY_BUILDER,
  "prepare_recovery_hand": PREPARE_RECOVERY_HAND,
  "archive_outcome": ARCHIVE_OUTCOME,
  "open_execution_deck": OPEN_EXECUTION_DECK,
};

export const EXECUTION_HANDS: ExecutionHand[] = [
  {
    id: "hand-reviewer",
    name: "Reviewer Hand",
    description: "Standard review workflow: capture build, request codex review, summarize, archive.",
    cards: ["capture_builder_result", "request_codex_review", "summarize_review", "archive_outcome"],
  },
  {
    id: "hand-recovery",
    name: "Recovery Hand",
    description: "Recovery workflow: retry build, escalate if needed, prepare recovery hand.",
    cards: ["retry_builder", "escalate_to_lead", "prepare_recovery_hand"],
  },
  {
    id: "hand-runtime-control",
    name: "Runtime Control Hand",
    description: "Runtime control: hold, clear, emergency halt.",
    cards: ["hold_runtime", "clear_runtime", "emergency_halt"],
  },
  {
    id: "hand-teaching",
    name: "Teaching Hand",
    description: "Teaching workflow: start teaching mode, acknowledge steps.",
    cards: ["start_teaching_mode", "acknowledge_step"],
  },
  {
    id: "hand-capture",
    name: "Capture Hand",
    description: "Capture workflow: capture last ChatGPT response, capture review result, capture builder result.",
    cards: ["capture_last_chatgpt_response", "capture_review_result", "capture_builder_result"],
  },
];

export function getCard(id: string): ExecutionCard | undefined {
  return EXECUTION_CARD_REGISTRY[id];
}

export function getCardsByCategory(category: CardCategory): ExecutionCard[] {
  return Object.values(EXECUTION_CARD_REGISTRY).filter((card) => card.category === category);
}

export function getEnabledCards(): ExecutionCard[] {
  return Object.values(EXECUTION_CARD_REGISTRY).filter((card) => card.enabled);
}

export function getEnabledCardsByCategory(category: CardCategory): ExecutionCard[] {
  return getEnabledCards().filter((card) => card.category === category);
}

export function resolveCardByAlias(alias: string): ExecutionCard | undefined {
  const normalized = alias.toLowerCase().trim();
  return Object.values(EXECUTION_CARD_REGISTRY).find((card) => {
    if (card.name.toLowerCase() === normalized) return true;
    if (card.aliases?.some((a) => a.toLowerCase() === normalized)) return true;
    return false;
  });
}

export function getHand(id: string): ExecutionHand | undefined {
  return EXECUTION_HANDS.find((h) => h.id === id);
}

export function getAllHands(): ExecutionHand[] {
  return [...EXECUTION_HANDS];
}

export function getHandCards(handId: string): ExecutionCard[] {
  const hand = getHand(handId);
  if (!hand) return [];
  return hand.cards.map((id) => getCard(id)).filter((c): c is ExecutionCard => c !== undefined);
}