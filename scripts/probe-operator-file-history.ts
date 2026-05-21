import {
  canNavigateOperatorFileBack,
  canNavigateOperatorFileForward,
  operatorFileHistoryBackIndex,
  operatorFileHistoryForwardIndex,
  pushOperatorFileHistory,
} from "../src/lib/operator-file-history";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

let history: string[] = [];
let index = -1;
let active: string | null = null;

function open(path: string) {
  const pushed = pushOperatorFileHistory(history, index, path, active);
  if (pushed) {
    history = pushed.history;
    index = pushed.historyIndex;
  }
  active = path;
}

open("a.md");
assert("first entry", history.length === 1 && index === 0 && active === "a.md");

open("b.md");
assert("second entry", history[1] === "b.md" && index === 1);

const backIdx = operatorFileHistoryBackIndex(index);
assert("back index", backIdx === 0);
index = backIdx!;
active = history[index];

open("c.md");
assert("trim forward", history.length === 2 && history[1] === "c.md" && index === 1);

open("c.md");
assert("skip duplicate active", history.length === 2 && index === 1);

assert("cannot back at start", !canNavigateOperatorFileBack(0));
assert("can forward", canNavigateOperatorFileForward(history, 0));
assert(
  "forward index",
  operatorFileHistoryForwardIndex(history, 0) === 1,
);

console.log("\nAll operator file history probes passed.");
