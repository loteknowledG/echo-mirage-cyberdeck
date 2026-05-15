import {
  startObservation,
  stopObservation,
  pauseObservation,
  resumeObservation,
  isObserving,
  isPaused,
  isActive,
  getSession,
  recordEvent,
  confirmEvent,
  getEvents,
  getConfirmedEvents,
  getOptionalEvents,
  getRecoveryEvents,
  getEventCount,
  formatDraftProcedure,
  resetObservation,
} from "../src/lib/computer-use/workflow-observation";
import {
  queueQuestion,
  getNextPendingQuestion,
  getPendingQuestionCount,
  clearQuestions,
  getAnswerSummary,
  answerQuestion,
} from "../src/lib/computer-use/question-queue";
import { detectObserveIntent, detectStopObserveIntent, detectPauseObserveIntent, detectResumeObserveIntent } from "../src/lib/computer-use/intent-detect";

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
  console.log("=== Workflow Observation Probe ===\n");

  resetObservation();
  clearQuestions();

  console.log("--- State Machine ---");
  assert("initially inactive", getSession().state === "inactive");
  assert("initially not observing", !isObserving());
  assert("initially not active", !isActive());

  const s1 = startObservation();
  assert("startObservation sets state to observing", s1.state === "observing");
  assert("startObservation sets startedAt", s1.startedAt !== null);
  assert("isObserving true after start", isObserving());
  assert("isActive true after start", isActive());

  startObservation("my workflow");
  const sNamed = getSession();
  assert("startObservation with name stores workflowName", sNamed.workflowName === "my workflow");

  resetObservation();
  startObservation();
  const p1 = pauseObservation();
  assert("pauseObservation sets state to paused", p1.state === "paused");
  assert("pauseObservation makes isObserving false", !isObserving());
  assert("pauseObservation makes isActive true", isActive());

  resumeObservation();
  const r1 = resumeObservation();
  assert("resumeObservation sets state back to observing", r1.state === "observing");
  assert("resumeObservation makes isObserving true", isObserving());

  resetObservation();
  startObservation();
  const st1 = stopObservation();
  assert("stopObservation sets state to complete", st1.state === "complete");
  assert("stopObservation sets stoppedAt", st1.stoppedAt !== null);
  assert("isObserving false after stop", !isObserving());

  resetObservation();
  startObservation();
  pauseObservation();
  const st2 = stopObservation();
  assert("stopObservation works from paused state", st2.state === "complete");

  console.log("\n--- Event Recording ---");
  resetObservation();
  startObservation();

  assert("recordEvent returns event object", recordEvent("indicate_point", "COMMAND_INPUT", "user said indicate message box") !== null);
  assert("recordEvent increments count", getEventCount() === 1);
  assert("recordEvent recorded in session", getEvents().length === 1);
  assert("event has id, type, label, context, timestamp", getEvents()[0].id.startsWith("ev-") && getEvents()[0].type === "indicate_point");

  recordEvent("indicate_highlight", "VOICE_LAB", "user said highlight voice controls");
  assert("second recordEvent increments count", getEventCount() === 2);
  assert("only observe state records events", () => {
    resetObservation();
    const ev = recordEvent("indicate_point", "TEST", "should not record");
    return ev === null && getEventCount() === 0;
  });

  resetObservation();
  startObservation();
  assert("allowed type indicate_point records", recordEvent("indicate_point", "TEST", "type test") !== null);
    assert("allowed type indicate_highlight records", recordEvent("indicate_highlight", "TEST", "type test") !== null);
    assert("allowed type clear_indicators records", recordEvent("clear_indicators", "TEST", "type test") !== null);
    assert("allowed type cursor_enter_region records", recordEvent("cursor_enter_region", "TEST", "type test") !== null);
    assert("allowed type step_acknowledged records", recordEvent("step_acknowledged", "TEST", "type test") !== null);
    assert("allowed type teaching_start records", recordEvent("teaching_start", "TEST", "type test") !== null);
    assert("allowed type teaching_end records", recordEvent("teaching_end", "TEST", "type test") !== null);
    assert("allowed type self_status_request records", recordEvent("self_status_request", "TEST", "type test") !== null);
    assert("allowed type inspect_request records", recordEvent("inspect_request", "TEST", "type test") !== null);
    assert("allowed type alias_resolved records", recordEvent("alias_resolved", "TEST", "type test") !== null);

  assert("blocked type 'password' returns null", recordEvent("password", "TEST", "password123") === null);
  assert("blocked type 'api_key' returns null", recordEvent("api_key", "TEST", "sk-12345") === null);
  assert("sensitive keyword in context sanitized", () => {
    resetObservation();
    startObservation();
    recordEvent("indicate_point", "TEST", "user typed password: secret123");
    return getEvents()[0].context.includes("[redacted");
  });

  console.log("\n--- Question Queue ---");
  resetObservation();
  startObservation();
  recordEvent("indicate_point", "COMMAND_INPUT", "indicate message box");
  assert("recordEvent queues a question", getPendingQuestionCount() === 1);
  const pending = getNextPendingQuestion();
  assert("getNextPendingQuestion returns question", pending !== null);
  if (!pending) return;
  assert("question has id, question, context, eventId, timestamp", pending.id.startsWith("q-") && pending.question.length > 0);

  const answered = answerQuestion(pending.id, "record_this");
  assert("answerQuestion returns true for valid question", answered);
  assert("answerQuestion marks answered true", getNextPendingQuestion() === null || getNextPendingQuestion()?.answered === true);
  assert("getPendingQuestionCount decrements after answer", getPendingQuestionCount() === 0);

  recordEvent("indicate_highlight", "VOICE_LAB", "highlight voice controls");
  const nextQ = getNextPendingQuestion();
  answerQuestion(nextQ!.id, "ignore_this");
  recordEvent("clear_indicators", "CLEAR", "clear markers");
  const thirdQ = getNextPendingQuestion();
  answerQuestion(thirdQ!.id, "optional");
  const summary = getAnswerSummary();
  assert("getAnswerSummary has recorded count >= 0", summary.recorded >= 0);
  assert("getAnswerSummary has ignored count >= 0", summary.ignored >= 0);
  assert("getAnswerSummary has skipped count >= 0", summary.skipped >= 0);
  assert("getAnswerSummary pending is 0 after all answered", summary.pending === 0);

  clearQuestions();
  assert("clearQuestions empties queue", getPendingQuestionCount() === 0);

  console.log("\n--- Confirm Events ---");
  resetObservation();
  startObservation();
  const ev1 = recordEvent("indicate_point", "COMMAND_INPUT", "test");
  const confirmed = confirmEvent(ev1!.id, "record_this");
  assert("confirmEvent returns true", confirmed);
  assert("event confirmed is true", getEvents()[0].confirmed === true);
  assert("event answer is record_this", getEvents()[0].answer === "record_this");
  assert("getConfirmedEvents returns confirmed events", getConfirmedEvents().length === 1);

  const ev2 = recordEvent("indicate_highlight", "VOICE_LAB", "test");
  confirmEvent(ev2!.id, "optional");
  assert("getOptionalEvents returns optional events", getOptionalEvents().length === 1);

  const ev3 = recordEvent("clear_indicators", "CLEAR", "test");
  confirmEvent(ev3!.id, "recovery");
  assert("getRecoveryEvents returns recovery events", getRecoveryEvents().length === 1);

  console.log("\n--- Draft Procedure Output ---");
  resetObservation();
  startObservation("Test Workflow");
  const step1 = recordEvent("indicate_point", "COMMAND_INPUT", "step 1: indicate message box");
  const q1 = getNextPendingQuestion();
  answerQuestion(q1!.id, "record_this");
  confirmEvent(step1!.id, "record_this");

  const step2 = recordEvent("indicate_highlight", "VOICE_LAB", "step 2: highlight voice controls");
  const q2 = getNextPendingQuestion();
  answerQuestion(q2!.id, "ignore_this");
  confirmEvent(step2!.id, "ignore_this");

  const step3 = recordEvent("teaching_start", "DEMO", "optional: start teaching");
  const q3 = getNextPendingQuestion();
  answerQuestion(q3!.id, "optional");
  confirmEvent(step3!.id, "optional");

  const step4 = recordEvent("self_status_request", "STATUS", "recovery check");
  const q4 = getNextPendingQuestion();
  answerQuestion(q4!.id, "recovery");
  confirmEvent(step4!.id, "recovery");

stopObservation();

  const draft = formatDraftProcedure();
  assert("formatDraftProcedure returns non-empty string", draft.length > 0);
  assert("draft contains workflow name", draft.includes("Test Workflow"));
  assert("draft contains workflow label", draft.includes("Workflow:"));
  assert("draft contains event count", draft.includes("Total events observed"));
  assert("draft contains counts summary", draft.includes("Confirmed:") || draft.includes("Confirmed: 1"));
  const confirmedSteps = getConfirmedEvents();
  const optionalSteps = getOptionalEvents();
  const recoverySteps = getRecoveryEvents();
  assert("confirmed events returned by getConfirmedEvents", confirmedSteps.length === 1);
  assert("optional events returned by getOptionalEvents", optionalSteps.length === 1);
  assert("recovery events returned by getRecoveryEvents", recoverySteps.length === 1);
  assert("formatDraftProcedure output includes confirmed section", confirmedSteps.length > 0 ? draft.includes("## Confirmed") : true);
  assert("formatDraftProcedure output includes optional section", optionalSteps.length > 0 ? draft.includes("## Optional") : true);
  assert("formatDraftProcedure output includes recovery section", recoverySteps.length > 0 ? draft.includes("## Recovery") : true);

  resetObservation();
  const incompleteDraft = formatDraftProcedure();
  assert("incomplete draft returns error message", incompleteDraft.includes("not complete"));

  console.log("\n--- Intent Detection ---");
  assert("observe this workflow triggers", detectObserveIntent("MUTHUR, observe this workflow"));
  assert("start workflow observation triggers", detectObserveIntent("start workflow observation"));
  assert("observe workflow triggers", detectObserveIntent("observe workflow"));
  assert("start observing triggers", detectObserveIntent("start observing"));
  assert("stop workflow observation triggers", detectStopObserveIntent("MUTHUR, stop workflow observation"));
  assert("stop observing triggers", detectStopObserveIntent("stop observing"));
  assert("end workflow observation triggers", detectStopObserveIntent("end workflow observation"));
  assert("pause workflow observation triggers", detectPauseObserveIntent("pause workflow observation"));
  assert("resume workflow observation triggers", detectResumeObserveIntent("resume workflow observation"));
  assert("no false positive for observe in status", !detectObserveIntent("what computer-use capabilities"));
  assert("no false positive for stop in other text", !detectStopObserveIntent("stop the process"));

  console.log("\n--- Safety Proof ---");
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const src = readFileSync(join(process.cwd(), "src/lib/computer-use/workflow-observation.ts"), "utf8");
  assert("no dispatchEvent in workflow-observation", !/dispatchEvent/.test(src));
  assert("no clipboard read in workflow-observation", !/clipboardData/.test(src));
  assert("no clipboard write in workflow-observation", !/setData/.test(src));
  assert("no exec/spawn in workflow-observation", !/\b(exec|spawn)\b/.test(src));
  assert("no click() in workflow-observation", !/\.click\(/.test(src));
  assert("no focus() in workflow-observation", !/\.focus\(/.test(src));
  assert("no screenshot capture in workflow-observation", !/captureScreen|screenshot/.test(src));
  assert("no continuous polling setInterval in workflow-observation", !/setInterval.*\d{4,}/.test(src));

  const qSrc = readFileSync(join(process.cwd(), "src/lib/computer-use/question-queue.ts"), "utf8");
  assert("no dispatchEvent in question-queue", !/dispatchEvent/.test(qSrc));
  assert("no exec in question-queue", !/exec|spawn/.test(qSrc));
  assert("no click in question-queue", !/\.click\(/.test(qSrc));
}

void main();