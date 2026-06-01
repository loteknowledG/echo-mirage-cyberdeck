import { NextResponse } from "next/server";
import { getHealthState, formatHealthStatus, getHealthEmoji, type HealthStatus } from "@/lib/muthur/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = getHealthState();
  const summary = {
    overall: { status: state.overallStatus, emoji: getHealthEmoji(state.overallStatus), label: formatHealthStatus(state.overallStatus) },
    provider: { ...state.provider, statusLabel: formatHealthStatus(state.provider.status), statusEmoji: getHealthEmoji(state.provider.status) },
    executionLoop: { ...state.executionLoop, statusLabel: formatHealthStatus(state.executionLoop.status), statusEmoji: getHealthEmoji(state.executionLoop.status) },
    editorContext: { ...state.editorContext, statusLabel: formatHealthStatus(state.editorContext.status), statusEmoji: getHealthEmoji(state.editorContext.status) },
    browserContext: { ...state.browserContext, statusLabel: formatHealthStatus(state.browserContext.status), statusEmoji: getHealthEmoji(state.browserContext.status) },
    intentRouter: { ...state.intentRouter, statusLabel: formatHealthStatus(state.intentRouter.status), statusEmoji: getHealthEmoji(state.intentRouter.status) },
    lastFailure: state.lastFailure ? {
      ...state.lastFailure,
      age: Date.now() - state.lastFailure.timestamp,
      timestamp: new Date(state.lastFailure.timestamp).toISOString(),
    } : null,
  };
  return NextResponse.json({ ok: true, health: summary }, { headers: { "Cache-Control": "no-store" } });
}