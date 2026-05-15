export type ClarifyingQuestion = {
  id: string;
  question: string;
  context: string;
  eventId: string;
  timestamp: string;
};

export type SupportedAnswer =
  | "yes"
  | "no"
  | "skip"
  | "record_this"
  | "ignore_this"
  | "optional"
  | "recovery";

const CLARIFYING_QUESTIONS: Record<string, string[]> = {
  indicate_point: [
    "Is this indicator step required in the workflow?",
    "Should I record this pointing action as part of the procedure?",
  ],
  indicate_highlight: [
    "Is this highlight step necessary for the workflow?",
    "Should I include this highlighting action in the procedure?",
  ],
  clear_indicators: [
    "Is this indicator-clearing step part of the workflow?",
    "Should I record this as a cleanup step?",
  ],
  cursor_enter_region: [
    "Was this cursor movement into the highlighted region a key step?",
    "Should I record this cursor entry as a step trigger?",
  ],
  step_acknowledged: [
    "Is this step acknowledgment part of the workflow sequence?",
    "Should I include this in the procedure?",
  ],
  teaching_start: [
    "Is this teaching session part of the workflow I'm observing?",
    "Should I record the teaching steps as part of this procedure?",
  ],
  teaching_end: [
    "Should I include the teaching completion as part of the workflow?",
    "Was the teaching session a deliberate step or a separate action?",
  ],
  self_status_request: [
    "Was this status check part of the workflow?",
    "Should I record this as a diagnostic step?",
  ],
  inspect_request: [
    "Is this screen inspection part of the workflow?",
    "Should I include this inspection action in the procedure?",
  ],
  alias_resolved: [
    "Is this target indication part of the workflow?",
    "Should I record this as a UI interaction step?",
  ],
};

export interface QuestionEntry {
  id: string;
  question: string;
  context: string;
  eventId: string;
  timestamp: string;
  answered: boolean;
  answer?: SupportedAnswer;
}

let queue: QuestionEntry[] = [];

function getNextQuestion(eventType: string): string {
  const qs = CLARIFYING_QUESTIONS[eventType];
  if (!qs || qs.length === 0) {
    return "Should I record this action in the workflow procedure?";
  }
  return qs[Math.floor(Math.random() * qs.length)];
}

export function queueQuestion(eventType: string, context: string, eventId: string): QuestionEntry {
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const question = getNextQuestion(eventType);
  const entry: QuestionEntry = {
    id,
    question,
    context,
    eventId,
    timestamp: new Date().toISOString(),
    answered: false,
  };
  queue.push(entry);
  return entry;
}

export function answerQuestion(questionId: string, answer: SupportedAnswer): boolean {
  const entry = queue.find((q) => q.id === questionId);
  if (!entry || entry.answered) return false;
  entry.answer = answer;
  entry.answered = true;
  return true;
}

export function getNextPendingQuestion(): QuestionEntry | null {
  return queue.find((q) => !q.answered) ?? null;
}

export function getQuestionQueue(): readonly QuestionEntry[] {
  return [...queue];
}

export function getPendingQuestionCount(): number {
  return queue.filter((q) => !q.answered).length;
}

export function hasPendingQuestions(): boolean {
  return getPendingQuestionCount() > 0;
}

export function clearQuestions(): void {
  queue = [];
}

export function removeAnsweredQuestions(): void {
  queue = queue.filter((q) => !q.answered);
}

export function getAnswerSummary(): { recorded: number; ignored: number; skipped: number; pending: number } {
  let recorded = 0;
  let ignored = 0;
  let skipped = 0;
  let pending = 0;
  for (const q of queue) {
    if (!q.answered) {
      pending++;
    } else {
      switch (q.answer) {
        case "record_this":
        case "yes":
        case "optional":
          recorded++;
          break;
        case "ignore_this":
        case "no":
          ignored++;
          break;
        case "skip":
        case "recovery":
          skipped++;
          break;
      }
    }
  }
  return { recorded, ignored, skipped, pending };
}