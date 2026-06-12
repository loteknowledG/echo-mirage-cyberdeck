import type { CaseEvent } from "@/lib/property-manager/cases/types";

export function formatTimelineClock(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function appendTimelineLine(existing: string, iso: string, note: string): string {
  const line = `${formatTimelineClock(iso)} ${note}`;
  const trimmed = existing.trimEnd();
  if (!trimmed) {
    return `# Timeline\n\n${line}\n`;
  }
  return `${trimmed}\n${line}\n`;
}

/** Human-readable action entry — append-only, em dash separator. */
export function appendActionTimelineEntry(existing: string, iso: string, note: string): string {
  const line = `${formatTimelineClock(iso)} — ${note.trim()}`;
  const trimmed = existing.trimEnd();
  if (!trimmed || trimmed === "# Timeline") {
    return `# Timeline\n\n${line}\n`;
  }
  return `${trimmed}\n${line}\n`;
}

export function appendCaseEvent(existing: CaseEvent[], event: CaseEvent): CaseEvent[] {
  return [...existing, event];
}
