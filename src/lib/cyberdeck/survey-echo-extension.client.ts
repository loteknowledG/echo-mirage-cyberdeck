"use client";

import {
  resolveSurveyEchoDeckContext,
  type SurveyDeckCommandContext,
} from "@/lib/cyberdeck/survey-deck-command.client";
import { ingestSurveyExtensionPageContext } from "@/lib/cyberdeck/survey-extension-page-context.client";
import type { SurveyExtensionTabOption } from "@/lib/cyberdeck/survey-extension-page-context";
import { isHttpsBrowserClient } from "@/lib/cyberdeck/survey-pairing-shared.client";
import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";
import { DEFAULT_ECHO_HTTP_PORT } from "@/lib/cyberdeck/survey-pair-pin";

const LINKED_TAB_STORAGE_KEY = "echo-mirage-echo-extension-linked-tab-id";

export type EchoExtensionRemoteResult = {
  ok: boolean;
  message: string;
  tabs?: SurveyExtensionTabOption[];
  snapshotIngested?: boolean;
};

function commandBody(action: string, extra?: { tabId?: number }) {
  const body: { action: string; tabId?: number } = { action };
  if (Number.isFinite(extra?.tabId)) {
    body.tabId = extra!.tabId;
  }
  return body;
}

/**
 * Same-machine Phase 1: browser → Echo Satellite directly (CORS *).
 * Required for Zen/other browsers; cyberdeck-electron can also use the Next proxy.
 * HTTPS Mirage (Vercel) cannot call http://127.0.0.1 (mixed content) — use local HTTP cyberdeck.
 */
async function postEchoCommandDirectLocal(
  action: string,
  port: number,
  extra?: { tabId?: number },
): Promise<Record<string, unknown> | null> {
  if (typeof window === "undefined") return null;
  if (isHttpsBrowserClient() && !isEchoMirageDesktopShell()) {
    return null;
  }

  const body = JSON.stringify(commandBody(action, extra));
  for (const host of ["127.0.0.1", "localhost"] as const) {
    try {
      const res = await fetch(`http://${host}:${port}/api/survey/echo/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const payload = (await res.json()) as Record<string, unknown>;
      if (res.ok && payload.ok === true) return payload;
      if (payload.ok === false) return payload;
    } catch {
      /* try next host */
    }
  }
  return null;
}

async function postEchoRemoteCommand(
  action: string,
  ctx: SurveyDeckCommandContext,
  extra?: { tabId?: number },
): Promise<Record<string, unknown>> {
  const port = ctx.echoHttpPort || DEFAULT_ECHO_HTTP_PORT;

  const direct = await postEchoCommandDirectLocal(action, port, extra);
  if (direct) return direct;

  if (isHttpsBrowserClient() && !isEchoMirageDesktopShell()) {
    return {
      ok: false,
      reason:
        "Same-machine Phase 1 needs Mirage on local HTTP cyberdeck (e.g. http://127.0.0.1:<port>/cyberdeck) — not Vercel HTTPS. Or use cyberdeck-electron. Mixed content blocks browser → Echo :3050.",
    };
  }

  const host = ctx.echoHost?.trim() || "127.0.0.1";

  const params = new URLSearchParams({
    echoHost: host,
    echoHttpPort: String(port),
  });

  try {
    const res = await fetch(`/api/survey/echo/remote-command?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commandBody(action, extra)),
    });
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? err.message
          : "Could not reach echo-electron — is Echo Satellite running on :3050?",
    };
  }
}

export function readLinkedEchoExtensionTabId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LINKED_TAB_STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeLinkedEchoExtensionTabId(tabId: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (tabId == null) {
      window.sessionStorage.removeItem(LINKED_TAB_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(LINKED_TAB_STORAGE_KEY, String(tabId));
  } catch {
    /* ignore */
  }
}

function asTabOptions(raw: unknown): SurveyExtensionTabOption[] {
  if (!Array.isArray(raw)) return [];
  const out: SurveyExtensionTabOption[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const tabId = typeof r.tabId === "number" ? r.tabId : Number(r.tabId);
    if (!Number.isFinite(tabId)) continue;
    const title = typeof r.title === "string" ? r.title : "(untitled)";
    const url = typeof r.url === "string" ? r.url : "";
    const distinguisher = typeof r.distinguisher === "string" ? r.distinguisher : url;
    const label = typeof r.label === "string" ? r.label : `${title} — ${distinguisher}`;
    out.push({ tabId, title, url, distinguisher, label });
  }
  return out;
}

export async function listEchoExtensionTabs(
  ctx: SurveyDeckCommandContext = resolveSurveyEchoDeckContext(),
): Promise<EchoExtensionRemoteResult> {
  try {
    const payload = await postEchoRemoteCommand("echo.ext-list-tabs", ctx);
    if (payload.ok !== true) {
      return {
        ok: false,
        message:
          typeof payload.reason === "string"
            ? payload.reason
            : "echo-extension list failed via echo-electron.",
      };
    }
    return {
      ok: true,
      message: typeof payload.message === "string" ? payload.message : "Tabs listed.",
      tabs: asTabOptions(payload.tabs),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "echo-extension list failed.",
    };
  }
}

export async function captureEchoExtensionTab(
  tabId: number,
  ctx: SurveyDeckCommandContext = resolveSurveyEchoDeckContext(),
): Promise<EchoExtensionRemoteResult> {
  try {
    const payload = await postEchoRemoteCommand("echo.ext-capture-text", ctx, { tabId });
    if (payload.ok !== true) {
      return {
        ok: false,
        message:
          typeof payload.reason === "string"
            ? payload.reason
            : "echo-extension capture failed via echo-electron.",
      };
    }

    const snapshot = payload.snapshot;
    const ingested = ingestSurveyExtensionPageContext(snapshot);
    return {
      ok: true,
      message:
        typeof payload.message === "string"
          ? payload.message
          : "Captured via echo-extension.",
      snapshotIngested: Boolean(ingested),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "echo-extension capture failed.",
    };
  }
}

/** Phase 1 — current active tab on capture Chrome (via Echo Satellite bridge). */
export async function captureEchoExtensionActiveTab(
  ctx: SurveyDeckCommandContext = resolveSurveyEchoDeckContext(),
): Promise<EchoExtensionRemoteResult> {
  try {
    const payload = await postEchoRemoteCommand("echo.ext-capture-active", ctx);
    if (payload.ok !== true) {
      return {
        ok: false,
        message:
          typeof payload.reason === "string"
            ? payload.reason
            : "echo-extension active capture failed via echo-electron.",
      };
    }

    const snapshot = payload.snapshot;
    const ingested = ingestSurveyExtensionPageContext(snapshot);
    return {
      ok: true,
      message:
        typeof payload.message === "string"
          ? payload.message
          : "Captured active tab via echo-extension.",
      snapshotIngested: Boolean(ingested),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "echo-extension active capture failed.",
    };
  }
}
