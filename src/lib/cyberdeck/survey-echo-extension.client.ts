"use client";

import {
  resolveSurveyEchoDeckContext,
  type SurveyDeckCommandContext,
} from "@/lib/cyberdeck/survey-deck-command.client";
import { ingestSurveyExtensionPageContext } from "@/lib/cyberdeck/survey-extension-page-context.client";
import type { SurveyExtensionTabOption } from "@/lib/cyberdeck/survey-extension-page-context";

const LINKED_TAB_STORAGE_KEY = "echo-mirage-echo-extension-linked-tab-id";

export type EchoExtensionRemoteResult = {
  ok: boolean;
  message: string;
  tabs?: SurveyExtensionTabOption[];
  snapshotIngested?: boolean;
};

async function postEchoRemoteCommand(
  action: string,
  ctx: SurveyDeckCommandContext,
  extra?: { tabId?: number },
): Promise<Record<string, unknown>> {
  const host = ctx.echoHost?.trim();
  if (!host) {
    return { ok: false, reason: "Echo host unknown — link echo-electron in TEAM LINKS." };
  }

  const params = new URLSearchParams({
    echoHost: host,
    echoHttpPort: String(ctx.echoHttpPort),
  });

  const res = await fetch(`/api/survey/echo/remote-command?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, tabId: extra?.tabId }),
  });
  return (await res.json()) as Record<string, unknown>;
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
