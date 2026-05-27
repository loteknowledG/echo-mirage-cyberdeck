import { promises as fs } from "node:fs";
import path from "node:path";
import type { MuthurAction, MuthurActionResult } from "./execution-types";
import type { VerificationOutcome } from "./verification-types";

const LOG_DIR = path.join(process.cwd(), ".muthur", "logs");

export type AuditLogKind = "execution-session" | "tool-actions" | "safety-events";

async function ensureLogDir(): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

async function appendJsonl(file: AuditLogKind, entry: Record<string, unknown>): Promise<void> {
  await ensureLogDir();
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n";
  await fs.appendFile(path.join(LOG_DIR, `${file}.jsonl`), line, "utf8");
}

export async function auditExecutionSession(entry: Record<string, unknown>): Promise<void> {
  await appendJsonl("execution-session", entry);
}

export async function auditToolAction(
  action: MuthurAction,
  result?: MuthurActionResult,
  verification?: VerificationOutcome,
  receiptPath?: string,
): Promise<void> {
  await appendJsonl("tool-actions", {
    action_id: action.id,
    type: action.type,
    source: action.source,
    status: action.status,
    requires_confirmation: action.requires_confirmation,
    approval_status: action.approval_status ?? null,
    duration_ms: result?.duration_ms ?? null,
    success: result?.success ?? null,
    error: action.error ?? null,
    payload: action.payload,
    result: result ?? null,
    verification: verification ?? action.verification ?? null,
    receipt_path: receiptPath ?? action.receipt_path ?? null,
  });
}

export async function auditSafetyEvent(entry: Record<string, unknown>): Promise<void> {
  await appendJsonl("safety-events", entry);
}
