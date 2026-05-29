import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { validateBrowserUrl } from "@/lib/muthur/browser/browser-policy";
import { getLatestMuthurObservation } from "@/lib/muthur/observation/observation-store.server";
import {
  captureScreenshot,
  getSessionConsoleEntries,
  getSessionConsoleErrors,
  openRoute,
} from "./browser-bridge.server";
import { auditSafetyEvent } from "./audit-log";
import type { MuthurAction, MuthurActionResult } from "./execution-types";
import { isVerificationActionType } from "./execution-types";
import {
  isRunnableAction,
  validateReadFilePath,
  validateShellCommand,
  validateWaitMs,
  validateWriteFilePath,
} from "./safety-policy";
import { DEFAULT_VERIFICATION_BASE_URL, parseVerifyChecks, type VerifyConditionPayload } from "./verification-types";
import { buildCyberdeckRouteVerificationChecks, buildRouteVerificationChecks, runVerifyConditions } from "./verification-runner.server";

export function actionRequiresVerification(action: MuthurAction): boolean {
  if (isVerificationActionType(action.type)) return false;
  if (action.payload.verify_after === true) return true;
  return parseVerifyChecks(action.payload.verify_checks).length > 0;
}

export function verificationChecksForAction(action: MuthurAction): VerifyConditionPayload[] {
  const explicit = parseVerifyChecks(action.payload.verify_checks);
  if (explicit.length > 0) return explicit;
  if (action.payload.verify_after === true) {
    const route = typeof action.payload.route === "string" ? action.payload.route : "/";
    if (route === "/cyberdeck") return buildCyberdeckRouteVerificationChecks(route);
    return buildRouteVerificationChecks(route);
  }
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unsupportedResult(action: MuthurAction, note: string, startedAt: number): MuthurActionResult {
  return {
    success: false,
    duration_ms: Date.now() - startedAt,
    stderr: note,
    metadata: { status: "unsupported", action_type: action.type },
    verification_notes: note,
  };
}

function verificationActionResult(
  outcome: Awaited<ReturnType<typeof runVerifyConditions>>,
  startedAt: number,
): MuthurActionResult {
  return {
    success: outcome.passed,
    duration_ms: Date.now() - startedAt,
    metadata: { verification: outcome },
    verification_notes: outcome.checks
      .map((check) => `${check.passed ? "PASS" : "FAIL"} ${check.check}: ${check.message}`)
      .join("\n"),
    screenshot_path: outcome.evidence_paths[0],
  };
}

export async function runMuthurAction(
  action: MuthurAction,
  signal?: AbortSignal,
): Promise<MuthurActionResult> {
  const startedAt = Date.now();

  if (signal?.aborted) {
    return {
      success: false,
      duration_ms: 0,
      stderr: "Action cancelled before start.",
      metadata: { cancelled: true },
    };
  }

  if (!isRunnableAction(action.type)) {
    return unsupportedResult(action, `Unsupported action type: ${action.type}`, startedAt);
  }

  switch (action.type) {
    case "shell_command": {
      const command = typeof action.payload.command === "string" ? action.payload.command.trim() : "";
      const validation = validateShellCommand(command);
      if (!validation.ok) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: validation.reason,
          exit_code: 1,
        };
      }
      try {
        const stdout = execSync(command, { encoding: "utf-8", timeout: 60_000, cwd: process.cwd() });
        return {
          success: true,
          stdout: stdout.slice(0, 5000),
          exit_code: 0,
          duration_ms: Date.now() - startedAt,
          metadata: { command },
        };
      } catch (error) {
        const err = error as { status?: number; stdout?: string; stderr?: string; message?: string };
        return {
          success: false,
          stdout: typeof err.stdout === "string" ? err.stdout.slice(0, 5000) : "",
          stderr: (typeof err.stderr === "string" ? err.stderr : err.message || "Command failed.").slice(0, 2000),
          exit_code: typeof err.status === "number" ? err.status : 1,
          duration_ms: Date.now() - startedAt,
          metadata: { command },
        };
      }
    }

    case "read_file": {
      const filePath = typeof action.payload.path === "string" ? action.payload.path : "";
      const validation = validateReadFilePath(filePath);
      if (!validation.ok) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: validation.reason,
          exit_code: 1,
        };
      }
      try {
        const content = await fs.readFile(validation.abs, "utf8");
        return {
          success: true,
          stdout: content.slice(0, 8000),
          duration_ms: Date.now() - startedAt,
          metadata: { path: validation.abs, bytes: Buffer.byteLength(content, "utf8") },
        };
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "read_file failed.",
          exit_code: 1,
        };
      }
    }

    case "write_file": {
      const filePath = typeof action.payload.path === "string" ? action.payload.path : "";
      const validation = validateWriteFilePath(filePath);
      if (!validation.ok) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: validation.reason,
          exit_code: 1,
        };
      }
      const content = typeof action.payload.content === "string" ? action.payload.content : "";
      try {
        await fs.mkdir(path.dirname(validation.abs), { recursive: true });
        await fs.writeFile(validation.abs, content, "utf8");
        return {
          success: true,
          duration_ms: Date.now() - startedAt,
          metadata: {
            path: validation.abs,
            bytes_written: Buffer.byteLength(content, "utf8"),
          },
          verification_notes: "File written to workspace.",
        };
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "write_file failed.",
          exit_code: 1,
        };
      }
    }

    case "wait": {
      const validation = validateWaitMs(action.payload.ms);
      if (!validation.ok) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: validation.reason,
        };
      }
      await sleep(validation.ms);
      if (signal?.aborted) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: "Action cancelled during wait.",
          metadata: { cancelled: true },
        };
      }
      return {
        success: true,
        duration_ms: Date.now() - startedAt,
        metadata: { waited_ms: validation.ms },
      };
    }

    case "open_url": {
      const baseUrl = typeof action.payload.base_url === "string" ? action.payload.base_url : DEFAULT_VERIFICATION_BASE_URL;
      const target = typeof action.payload.url === "string"
        ? action.payload.url
        : typeof action.payload.route === "string"
          ? action.payload.route
          : "/";
      const validation = validateBrowserUrl(target, baseUrl);
      if (!validation.ok) {
        void auditSafetyEvent({
          event: "browser_url_blocked",
          action_id: action.id,
          action_type: action.type,
          url: validation.url,
          reason: validation.reason,
        });
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: validation.reason,
          metadata: { blocked_url: validation.url, status: "blocked" },
        };
      }
      try {
        const snapshot = await openRoute({
          route: typeof action.payload.route === "string" ? action.payload.route : undefined,
          url: typeof action.payload.url === "string" ? action.payload.url : undefined,
          base_url: baseUrl,
          capture_screenshot: action.payload.capture_screenshot !== false,
          screenshot_label: typeof action.payload.screenshot_label === "string" ? action.payload.screenshot_label : "open_url",
          wait_for_selector: typeof action.payload.wait_for_selector === "string" ? action.payload.wait_for_selector : undefined,
        });
        const consoleErrors = snapshot.console_entries.filter((entry) => entry.severity === "error");
        return {
          success: snapshot.status >= 200 && snapshot.status < 500,
          duration_ms: Date.now() - startedAt,
          stdout: snapshot.body_text_excerpt.slice(0, 2000),
          screenshot_path: snapshot.screenshot?.screenshot_path,
          metadata: {
            url: snapshot.url,
            title: snapshot.title,
            status: snapshot.status,
            console_error_count: consoleErrors.length,
            console_entries: snapshot.console_entries,
            screenshot: snapshot.screenshot,
          },
          verification_notes: `Navigated to ${snapshot.url} (${snapshot.status}).`,
        };
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "open_url failed.",
        };
      }
    }

    case "screenshot": {
      try {
        const label = typeof action.payload.label === "string" ? action.payload.label : "screenshot";
        const captured = await captureScreenshot(label);
        return {
          success: true,
          duration_ms: Date.now() - startedAt,
          screenshot_path: captured.screenshot_path,
          metadata: { screenshot: captured },
          verification_notes: "Screenshot captured.",
        };
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "screenshot failed.",
        };
      }
    }

    case "get_console_errors": {
      const entries = getSessionConsoleEntries();
      const errors = getSessionConsoleErrors();
      return {
        success: true,
        duration_ms: Date.now() - startedAt,
        stdout: errors.slice(0, 20).map((entry) => entry.message).join("\n"),
        metadata: {
          count: errors.length,
          entries,
          errors,
        },
      };
    }

    case "observe_operator_pane": {
      const requestedSurface =
        action.payload.surface === "property-manager" || action.payload.surface === "cyberdeck"
          ? action.payload.surface
          : undefined;
      const observation = getLatestMuthurObservation(requestedSurface);
      return {
        success: true,
        duration_ms: Date.now() - startedAt,
        stdout: JSON.stringify(observation ?? { status: "NO_VISIBLE_OBSERVATION" }, null, 2),
        metadata: {
          authority: "READ_ONLY_OBSERVATION",
          read_only: true,
          observation,
        },
        verification_notes: "Read-only operator observation retrieved; no action authority granted.",
      };
    }

    case "verify_condition": {
      try {
        const checks = parseVerifyChecks(action.payload.checks ?? action.payload);
        const outcome = await runVerifyConditions(checks);
        return verificationActionResult(outcome, startedAt);
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "verify_condition failed.",
        };
      }
    }

    case "verify_page_text": {
      try {
        const text = typeof action.payload.text === "string" ? action.payload.text : "";
        const route = typeof action.payload.route === "string" ? action.payload.route : "/";
        const baseUrl = typeof action.payload.base_url === "string" ? action.payload.base_url : DEFAULT_VERIFICATION_BASE_URL;
        const outcome = await runVerifyConditions([
          { check: "route_loads", route, base_url: baseUrl, expect_status: 200 },
          { check: "text_exists", text, route, base_url: baseUrl },
          { check: "screenshot_captured" },
        ]);
        return verificationActionResult(outcome, startedAt);
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "verify_page_text failed.",
        };
      }
    }

    case "verify_route_loaded": {
      try {
        const route = typeof action.payload.route === "string" ? action.payload.route : "/";
        const baseUrl = typeof action.payload.base_url === "string" ? action.payload.base_url : DEFAULT_VERIFICATION_BASE_URL;
        const expectStatus = typeof action.payload.expect_status === "number" ? action.payload.expect_status : 200;
        const outcome = await runVerifyConditions([
          { check: "route_loads", route, base_url: baseUrl, expect_status: expectStatus },
          { check: "screenshot_captured" },
        ]);
        return verificationActionResult(outcome, startedAt);
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "verify_route_loaded failed.",
        };
      }
    }

    case "verify_console_clean": {
      try {
        const max = typeof action.payload.max_console_errors === "number" ? action.payload.max_console_errors : 0;
        const outcome = await runVerifyConditions([{ check: "no_console_errors", max_console_errors: max }]);
        return verificationActionResult(outcome, startedAt);
      } catch (error) {
        return {
          success: false,
          duration_ms: Date.now() - startedAt,
          stderr: error instanceof Error ? error.message : "verify_console_clean failed.",
        };
      }
    }

    default:
      return unsupportedResult(action, `Action type not implemented: ${action.type}`, startedAt);
  }
}
