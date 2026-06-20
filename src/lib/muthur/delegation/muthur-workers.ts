import type { MuthurDelegationWorkerId } from "@/lib/muthur/delegation/muthur-delegation-types";

export type MuthurDelegationWorker = {
  id: MuthurDelegationWorkerId;
  label: string;
  role: string;
  handoffHint: string;
};

export const MUTHUR_DELEGATION_WORKERS: MuthurDelegationWorker[] = [
  {
    id: "pi",
    label: "Pi",
    role: "Embodiment / computer-use operator",
    handoffHint: "Pi executes desktop missions under an active control lease.",
  },
  {
    id: "cursor",
    label: "Cursor",
    role: "Interactive IDE editor",
    handoffHint: "Paste into Cursor Agent with repo context open.",
  },
  {
    id: "codex",
    label: "Codex",
    role: "Verification judge",
    handoffHint: "Paste into Codex for review, verification, or focused fixes.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    role: "Implementation engine",
    handoffHint: "Paste into OpenCode for implementation tasks.",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    role: "Lead / planner",
    handoffHint: "Paste into ChatGPT for planning or task decomposition.",
  },
  {
    id: "human",
    label: "Human Operator",
    role: "Final authority",
    handoffHint: "Present to the operator for manual execution.",
  },
  {
    id: "other",
    label: "Other Worker",
    role: "External capability",
    handoffHint: "Paste into the target worker's native interface.",
  },
];

export function getMuthurDelegationWorker(
  workerId: MuthurDelegationWorkerId,
): MuthurDelegationWorker {
  return (
    MUTHUR_DELEGATION_WORKERS.find((worker) => worker.id === workerId) ??
    MUTHUR_DELEGATION_WORKERS[MUTHUR_DELEGATION_WORKERS.length - 1]
  );
}
