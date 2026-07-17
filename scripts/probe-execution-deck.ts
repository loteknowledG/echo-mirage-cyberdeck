import {
  openDeck,
  clearDeck,
  prepareHand,
  stageCard,
  removeCard,
  updateCardStatus,
  getCardTableState,
  getStagedCardCount,
  getStackDepth,
  describeDeck,
  buildReviewerHand,
  isDeckOpen,
  pushHandToStack,
  attemptExecute,
  isExecutionEnabled,
  getTopStackCard,
  getStackCards,
  getCurrentStatuses,
  type ExecutionCard,
} from "../src/lib/computer-use/card-table";
import { detectExecDeckShowIntent, detectExecDeckPrepareIntent, detectExecDeckClearIntent, detectExecDeckPushIntent, detectExecDeckExecuteIntent } from "../src/lib/computer-use/intent-detect";

function assert(name: string, condition: boolean | (() => boolean), detail?: unknown) {
  const pass = typeof condition === "function" ? condition() : condition;
  if (!pass) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

function main() {
  console.log("=== Execution Deck v0.1 Probe ===\n");

  clearDeck();

  console.log("--- State Machine ---");
  assert("initially deck closed", !isDeckOpen());
  assert("initially no staged cards", getStagedCardCount() === 0);
  assert("initially stack depth 0", getStackDepth() === 0);

  openDeck();
  assert("openDeck marks deck open", isDeckOpen());

  console.log("\n--- Execution Gate ---");
  assert("execution disabled by default", !isExecutionEnabled());
  const blocked = attemptExecute();
  assert("attemptExecute blocked when disabled", !blocked.success);
  assert("attemptExecute reports execution disabled", blocked.reason === "Execution disabled in v0.1");

  console.log("\n--- Reviewer Hand ---");
  const reviewerCards = buildReviewerHand();
  assert("buildReviewerHand returns 4 cards", reviewerCards.length === 4);
  assert("first card title correct", reviewerCards[0].title === "Capture Builder Result");
  assert("second card title correct", reviewerCards[1].title === "Request Codex Review");
  assert("third card title correct", reviewerCards[2].title === "Summarize Review");
  assert("fourth card title correct", reviewerCards[3].title === "Archive Outcome");
  assert("all cards staged status", reviewerCards.every((c) => c.status === "staged"));
  assert("all cards have scriptName", reviewerCards.every((c) => c.scriptName !== undefined));

  console.log("\n--- Hand Preparation (staging only, no auto-stack) ---");
  clearDeck();
  const hand = prepareHand("Reviewer Hand", reviewerCards);
  assert("prepareHand returns hand", hand.name === "Reviewer Hand");
  assert("hand has 4 cards", hand.cards.length === 4);
  const state = getCardTableState();
  assert("staged hand set", state.stagedHand !== null);
  assert("staged hand name correct", state.stagedHand!.name === "Reviewer Hand");
  assert("activeHand set to hand name", state.activeHand === "Reviewer Hand");
  assert("stack empty after prepareHand (no auto-populate)", state.executionStack.length === 0);
  assert("currentCard null after prepareHand", state.currentCard === null);
  assert("staged card count is 4", getStagedCardCount() === 4);
  assert("stack depth is 0 after prepareHand", getStackDepth() === 0);

  console.log("\n--- Push Hand to Stack ---");
  const pushResult = pushHandToStack();
  assert("pushHandToStack returns pushed count", pushResult.pushed === 4);
  assert("pushHandToStack updates stackDepth", pushResult.stackDepth === 4);
  const postPush = getCardTableState();
  assert("staged hand null after push", postPush.stagedHand === null);
  assert("execution stack has 4 cards after push", postPush.executionStack.length === 4);
  assert("currentCard set to first card after push", postPush.currentCard !== null);
  assert("currentCard is Capture Builder Result", postPush.currentCard!.title === "Capture Builder Result");
  assert("all pushed cards status is stacked", postPush.executionStack.every((c) => c.status === "stacked"));
  assert("staged card count 0 after push", getStagedCardCount() === 0);
  assert("stack depth 4 after push", getStackDepth() === 4);

  console.log("\n--- Stack Accessors ---");
  const topCard = getTopStackCard();
  assert("getTopStackCard returns first card", topCard?.title === "Capture Builder Result");
  const allCards = getStackCards();
  assert("getStackCards returns all 4 cards", allCards.length === 4);
  const statuses = getCurrentStatuses();
  assert("getCurrentStatuses returns 4 entries", Object.keys(statuses).length === 4);
  assert("all statuses are stacked", Object.values(statuses).every((s) => s === "stacked"));

  console.log("\n--- Card Status Updates ---");
  const first = postPush.executionStack[0];
  const updated = updateCardStatus(first.id, "complete", "Build artifact captured successfully.");
  assert("updateCardStatus returns true", updated);
  const postUpdate = getCardTableState();
  assert("card status updated", postUpdate.executionStack.some((c) => c.status === "complete"));
  assert("card lastResult set", postUpdate.executionStack.some((c) => c.lastResult !== undefined));

  updateCardStatus(first.id, "running");
  const runningState = getCardTableState();
  assert("currentCard updates on running", runningState.currentCard?.status === "running");

  console.log("\n--- Remove Card ---");
  const stackLen = getStackDepth();
  const removed = removeCard(first.id);
  assert("removeCard returns true", removed);
  assert("stack depth decrements after removeCard", getStackDepth() === stackLen - 1);
  const afterRemove = getCardTableState();
  assert("currentCard advances after removeCard", afterRemove.currentCard?.title === "Request Codex Review");

  console.log("\n--- Clear Deck ---");
  clearDeck();
  const cleared = getCardTableState();
  assert("staged hand null after clear", cleared.stagedHand === null);
  assert("execution stack empty after clear", cleared.executionStack.length === 0);
  assert("current card null after clear", cleared.currentCard === null);
  assert("activeHand null after clear", cleared.activeHand === null);

  console.log("\n--- Describe Deck v0.1 ---");
  const emptyDesc = describeDeck();
  assert("empty deck describes as empty", emptyDesc.includes("empty"));
  assert("empty deck shows Execution DISABLED", emptyDesc.includes("DISABLED"));

  const cards2 = buildReviewerHand();
  prepareHand("Test Hand", cards2);
  const desc = describeDeck();
  assert("describeDeck mentions EXECUTION DECK", desc.includes("EXECUTION DECK"));
  assert("describeDeck mentions active hand", desc.includes("Test Hand"));
  assert("describeDeck lists all 4 cards", desc.includes("Capture Builder Result") && desc.includes("Request Codex Review") && desc.includes("Summarize Review") && desc.includes("Archive Outcome"));
  assert("describeDeck shows Execution DISABLED", desc.includes("DISABLED"));
  assert("describeDeck shows stack depth", desc.includes("Stack depth:"));
  assert("describeDeck shows staged cards section", desc.includes("Staged Hand"));

  const push2 = pushHandToStack();
  assert("second push returns 4", push2.pushed === 4);
  const stackDesc = describeDeck();
  assert("stack describe shows stack section", stackDesc.includes("Stack ("));
  assert("stack describe shows top marker", stackDesc.includes(">>>"));
  assert("stack describe shows stacked status marker", stackDesc.includes("[S]"));

  clearDeck();

  console.log("\n--- Intent Detection ---");
  assert("what is on the execution deck triggers", detectExecDeckShowIntent("MUTHUR, what is on the execution deck?"));
  assert("open execution deck triggers", detectExecDeckShowIntent("open execution deck"));
  assert("prepare reviewer hand triggers", detectExecDeckPrepareIntent("MUTHUR, prepare reviewer hand"));
  assert("prepare hand triggers", detectExecDeckPrepareIntent("prepare reviewer hand"));
  assert("stage reviewer hand triggers", detectExecDeckPrepareIntent("stage reviewer hand"));
  assert("clear execution deck triggers", detectExecDeckClearIntent("MUTHUR, clear execution deck"));
  assert("discard execution deck triggers", detectExecDeckClearIntent("discard execution deck"));
  assert("clear the deck triggers", detectExecDeckClearIntent("clear the deck"));
  assert("push hand to stack triggers", detectExecDeckPushIntent("MUTHUR, push hand to stack"));
  assert("push to stack triggers", detectExecDeckPushIntent("push to stack"));
  assert("commit hand triggers", detectExecDeckPushIntent("commit hand"));
  assert("execute deck triggers", detectExecDeckExecuteIntent("MUTHUR, execute deck"));
  assert("execute triggers", detectExecDeckExecuteIntent("execute deck"));
  assert("run stack triggers", detectExecDeckExecuteIntent("run stack"));
  assert("no false positive for deck in unrelated text", !detectExecDeckShowIntent("build the deck of cards"));
  assert("no false positive for prepare in unrelated text", !detectExecDeckPrepareIntent("prepare lunch"));
  assert("no false positive for push in unrelated text", !detectExecDeckPushIntent("push the cart"));
  assert("no false positive for execute in unrelated text", !detectExecDeckExecuteIntent("carrying out the command"));

  console.log("\n--- Safety Proof ---");
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const src = readFileSync(join(process.cwd(), "src/lib/computer-use/card-table.ts"), "utf8");
  assert("no dispatchEvent in execution-deck", !/dispatchEvent/.test(src));
  assert("no clipboard read in execution-deck", !/clipboardData/.test(src));
  assert("no clipboard write in execution-deck", !/setData/.test(src));
  assert("no exec/spawn in execution-deck", !/\b(exec|spawn)\b/.test(src));
  assert("no click() in execution-deck", !/\.click\(/.test(src));
  assert("no focus() in execution-deck", !/\.focus\(/.test(src));
  assert("no shell command execution", !/child_process/.test(src));
  assert("no fetch/HTTP requests in execution-deck", !/\bfetch\b/.test(src) || src.split("\n").filter((l: string) => /^\s*\b(fetch|http|HTTPS)\b/.test(l)).length === 0);
  assert("no real script execution", !/\.exec\(/.test(src) && !/spawn\(/.test(src));
  assert("no continuous setInterval polling", !/setInterval.*\d{4,}/.test(src));

  clearDeck();
}

void main();