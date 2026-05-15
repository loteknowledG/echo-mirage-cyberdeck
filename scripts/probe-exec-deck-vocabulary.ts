import {
  detectExecDeckShowIntent,
  detectExecDeckPrepareIntent,
  detectExecDeckDescribeStagedIntent,
  detectExecDeckPushIntent,
  detectExecDeckExecuteIntent,
  detectExecDeckClearIntent,
  classifyIntent,
} from "../src/lib/computer-use/intent-detect";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

console.log("\n=== Execution Deck Vocabulary Alias Probe ===\n");

console.log("## SHOW DECK patterns");
assert(detectExecDeckShowIntent("show execution deck"), "show execution deck");
assert(detectExecDeckShowIntent("show the deck"), "show the deck");
assert(detectExecDeckShowIntent("show deck"), "show deck");
assert(detectExecDeckShowIntent("what is on the deck"), "what is on the deck");
assert(detectExecDeckShowIntent("describe deck"), "describe deck");
assert(detectExecDeckShowIntent("muthur show the deck"), "muthur show the deck");
assert(!detectExecDeckShowIntent("prepare reviewer hand"), "prepare reviewer hand -> NOT show");
assert(!detectExecDeckShowIntent("push hand to stack"), "push hand to stack -> NOT show");

console.log("\n## PREPARE HAND patterns");
assert(detectExecDeckPrepareIntent("prepare reviewer hand"), "prepare reviewer hand");
assert(detectExecDeckPrepareIntent("prepare reviewer workflow"), "prepare reviewer workflow");
assert(detectExecDeckPrepareIntent("prepare reviewer combo"), "prepare reviewer combo");
assert(detectExecDeckPrepareIntent("prepare reviewer play"), "prepare reviewer play");
assert(detectExecDeckPrepareIntent("prepare reviewer routine"), "prepare reviewer routine");
assert(detectExecDeckPrepareIntent("prepare workflow"), "prepare workflow");
assert(detectExecDeckPrepareIntent("prepare combo"), "prepare combo");
assert(detectExecDeckPrepareIntent("prepare play"), "prepare play");
assert(detectExecDeckPrepareIntent("build reviewer hand"), "build reviewer hand");
assert(detectExecDeckPrepareIntent("build a hand"), "build a hand");
assert(detectExecDeckPrepareIntent("muthur prepare workflow"), "muthur prepare workflow");
assert(!detectExecDeckPrepareIntent("show execution deck"), "show execution deck -> NOT prepare");
assert(!detectExecDeckPrepareIntent("push hand to stack"), "push hand to stack -> NOT prepare");

console.log("\n## DESCRIBE STAGED patterns");
assert(detectExecDeckDescribeStagedIntent("what is in my hand"), "what is in my hand");
assert(detectExecDeckDescribeStagedIntent("describe my hand"), "describe my hand");
assert(detectExecDeckDescribeStagedIntent("what cards are in my hand"), "what cards are in my hand");
assert(detectExecDeckDescribeStagedIntent("show my hand"), "show my hand");
assert(detectExecDeckDescribeStagedIntent("whats in my hand"), "whats in my hand");
assert(!detectExecDeckDescribeStagedIntent("show execution deck"), "show execution deck -> NOT describe_staged");
assert(!detectExecDeckDescribeStagedIntent("push hand to stack"), "push hand to stack -> NOT describe_staged");

console.log("\n## PUSH TO STACK patterns");
assert(detectExecDeckPushIntent("push hand to stack"), "push hand to stack");
assert(detectExecDeckPushIntent("push play to stack"), "push play to stack");
assert(detectExecDeckPushIntent("push workflow to stack"), "push workflow to stack");
assert(detectExecDeckPushIntent("push combo to stack"), "push combo to stack");
assert(detectExecDeckPushIntent("push staged hand to stack"), "push staged hand to stack");
assert(detectExecDeckPushIntent("commit play"), "commit play");
assert(detectExecDeckPushIntent("commit workflow"), "commit workflow");
assert(detectExecDeckPushIntent("muthur push play to stack"), "muthur push play to stack");
assert(!detectExecDeckPushIntent("show execution deck"), "show execution deck -> NOT push");
assert(!detectExecDeckPushIntent("prepare reviewer hand"), "prepare reviewer hand -> NOT push");

console.log("\n## EXECUTE patterns");
assert(detectExecDeckExecuteIntent("execute"), "execute");
assert(detectExecDeckExecuteIntent("run the play"), "run the play");
assert(detectExecDeckExecuteIntent("execute the play"), "execute the play");
assert(detectExecDeckExecuteIntent("run the workflow"), "run the workflow");
assert(detectExecDeckExecuteIntent("execute the combo"), "execute the combo");
assert(detectExecDeckExecuteIntent("muthur run the play"), "muthur run the play");
assert(!detectExecDeckExecuteIntent("show execution deck"), "show execution deck -> NOT execute");
assert(!detectExecDeckExecuteIntent("prepare reviewer hand"), "prepare reviewer hand -> NOT execute");

console.log("\n## CLEAR patterns");
assert(detectExecDeckClearIntent("clear the deck"), "clear the deck");
assert(detectExecDeckClearIntent("clear deck"), "clear deck");
assert(detectExecDeckClearIntent("empty deck"), "empty deck");
assert(!detectExecDeckClearIntent("show execution deck"), "show execution deck -> NOT clear");
assert(!detectExecDeckClearIntent("prepare reviewer hand"), "prepare reviewer hand -> NOT clear");

console.log("\n## CLASSIFY INTENT routing");
assert(classifyIntent("show the deck") === "exec_deck_show", "classify: show the deck -> exec_deck_show");
assert(classifyIntent("prepare reviewer combo") === "exec_deck_prepare", "classify: prepare reviewer combo -> exec_deck_prepare");
assert(classifyIntent("what is in my hand") === "exec_deck_describe_staged", "classify: what is in my hand -> exec_deck_describe_staged");
assert(classifyIntent("push play to stack") === "exec_deck_push", "classify: push play to stack -> exec_deck_push");
assert(classifyIntent("run the play") === "exec_deck_execute", "classify: run the play -> exec_deck_execute");
assert(classifyIntent("clear the deck") === "exec_deck_clear", "classify: clear the deck -> exec_deck_clear");
assert(classifyIntent("show execution deck") === "exec_deck_show", "classify: show execution deck -> exec_deck_show");

console.log("\n### Summary");
console.log(`\nTotal: ${passed + failed} assertions`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Result: ${failed === 0 ? "ALL PASS" : "FAIL"}`);

if (failed > 0) process.exit(1);