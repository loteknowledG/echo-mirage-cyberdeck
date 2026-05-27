import { promises as fs } from "node:fs";
import path from "node:path";
import { getLastBrowserSnapshot } from "@/lib/muthur/browser/browser-session";
import { getMemory } from "@/muthur/memory/core";
import type { MuthurAction, MuthurActionResult } from "./execution-types";
import type { VerificationOutcome } from "./verification-types";

const RECEIPT_DIR = path.join(process.cwd(), ".muthur", "receipts", "verification");
const LOG_DIR = path.join(process.cwd(), ".muthur", "logs");

async function ensureDirs(): Promise<void> {
  await fs.mkdir(RECEIPT_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
}

export type VerificationReceiptRecord = {
  timestamp: string;
  task_id: string;
  action_id: string;
  action_type: string;
  task_label?: string | null;
  url?: string | null;
  screenshot_path?: string | null;
  execution_success: boolean;
  verification_passed: boolean;
  console_error_count: number;
  execution_result?: MuthurActionResult;
  verification: VerificationOutcome;
  evidence_paths: string[];
  receipt_path: string;
};

export async function writeVerificationReceipt(options: {
  action: MuthurAction;
  taskLabel?: string | null;
  executionResult: MuthurActionResult;
  verification: VerificationOutcome;
}): Promise<string> {
  await ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const receiptPath = path.join(RECEIPT_DIR, `${stamp}_${options.action.id.slice(0, 8)}.json`);
  const snapshot = getLastBrowserSnapshot();
  const routeLoadCheck = options.verification.checks.find((check) => check.check === "route_loads");
  const consoleCheck = options.verification.checks.find((check) => check.check === "no_console_errors");
  const consoleErrorCount =
    typeof consoleCheck?.metadata?.count === "number"
      ? consoleCheck.metadata.count
      : snapshot?.console_entries.filter((entry) => entry.severity === "error").length ?? 0;
  const screenshotPath =
    options.verification.evidence_paths[0] ??
    options.executionResult.screenshot_path ??
    snapshot?.screenshot?.screenshot_path ??
    null;

  const record: VerificationReceiptRecord = {
    timestamp: new Date().toISOString(),
    task_id: options.action.id,
    action_id: options.action.id,
    action_type: options.action.type,
    task_label: options.taskLabel ?? null,
    url:
      (typeof routeLoadCheck?.metadata?.url === "string" ? routeLoadCheck.metadata.url : null) ??
      snapshot?.url ??
      (typeof options.executionResult.metadata?.url === "string" ? options.executionResult.metadata.url : null),
    screenshot_path: screenshotPath,
    execution_success: options.executionResult.success,
    verification_passed: options.verification.passed,
    console_error_count: consoleErrorCount,
    execution_result: options.executionResult,
    verification: options.verification,
    evidence_paths: options.verification.evidence_paths,
    receipt_path: receiptPath,
  };
  await fs.writeFile(receiptPath, JSON.stringify(record, null, 2), "utf8");
  const jsonl = JSON.stringify({
    timestamp: record.timestamp,
    task_id: record.task_id,
    action_id: record.action_id,
    action_type: record.action_type,
    task_label: record.task_label,
    url: record.url,
    screenshot_path: record.screenshot_path,
    verification_checks: record.verification.checks.map((check) => ({
      check: check.check,
      passed: check.passed,
      message: check.message,
    })),
    console_error_count: record.console_error_count,
    verification_outcome: record.verification_passed ? "verified" : "verification_failed",
    execution_success: record.execution_success,
    evidence_paths: record.evidence_paths,
    receipt_path: receiptPath,
  });
  await fs.appendFile(path.join(LOG_DIR, "verification-receipts.jsonl"), `${jsonl}\n`, "utf8");

  try {
    const memory = getMemory();
    await memory.ready();
    memory.addReceipt(
      "verification",
      `${options.action.type}:${options.action.id}`,
      receiptPath,
      {
        passed: options.verification.passed,
        action_id: options.action.id,
        evidence_paths: options.verification.evidence_paths,
        task_label: options.taskLabel ?? null,
        url: record.url,
        console_error_count: record.console_error_count,
      },
    );
    memory.flush();
  } catch {
    /* memory optional in some contexts */
  }

  return receiptPath;
}
