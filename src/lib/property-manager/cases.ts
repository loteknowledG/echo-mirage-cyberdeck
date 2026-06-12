import type {
  CaseBoardFilter,
  CaseCallDetailPayload,
  CaseCallListItem,
  CaseDetailPayload,
  CaseListItem,
} from "@/lib/property-manager/cases/viewer-types";

export type { CaseBoardFilter, CaseCallDetailPayload, CaseCallListItem, CaseDetailPayload, CaseListItem };

export const CASE_BOARD_FILTERS: { id: CaseBoardFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "urgent", label: "Urgent" },
  { id: "emergency", label: "Emergency" },
  { id: "waiting", label: "Waiting" },
  { id: "needs-eta", label: "Needs ETA" },
  { id: "closed", label: "Closed" },
];

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchCaseBoardItems(filter: CaseBoardFilter = "open"): Promise<CaseListItem[]> {
  const params = new URLSearchParams({ filter });
  const data = await readJson<{ cases: CaseListItem[] }>(
    await fetch(`/api/property-manager/cases?${params.toString()}`),
  );
  return data.cases;
}

export async function fetchCaseDetail(slug: string): Promise<CaseDetailPayload> {
  return readJson<CaseDetailPayload>(
    await fetch(`/api/property-manager/cases/${encodeURIComponent(slug)}`),
  );
}

export async function performCaseAction(
  caseSlug: string,
  action: string,
  input?: Record<string, string>,
): Promise<CaseDetailPayload> {
  const data = await readJson<{ detail: CaseDetailPayload }>(
    await fetch(`/api/property-manager/cases/${encodeURIComponent(caseSlug)}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, input }),
    }),
  );
  return data.detail;
}

export async function fetchCaseCallDetail(
  caseSlug: string,
  callId: string,
): Promise<CaseCallDetailPayload> {
  return readJson<CaseCallDetailPayload>(
    await fetch(
      `/api/property-manager/cases/${encodeURIComponent(caseSlug)}/calls/${encodeURIComponent(callId)}`,
    ),
  );
}

export function formatCaseClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatCaseLabel(value: string): string {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function severityClass(severity: string): string {
  switch (severity) {
    case "emergency":
      return "text-rose-300";
    case "urgent":
      return "text-amber-300";
    case "low":
      return "text-[#8a8a8a]";
    default:
      return "text-emerald-300";
  }
}
