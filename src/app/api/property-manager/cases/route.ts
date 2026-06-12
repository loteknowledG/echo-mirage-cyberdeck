import { NextResponse } from "next/server";
import {
  filterCaseBoardItems,
  listCaseBoardItems,
  type CaseBoardFilter,
} from "@/lib/property-manager/cases/reader.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_FILTERS = new Set<CaseBoardFilter>([
  "open",
  "urgent",
  "emergency",
  "waiting",
  "needs-eta",
  "closed",
  "all",
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilter = searchParams.get("filter") ?? "open";
    const filter = VALID_FILTERS.has(rawFilter as CaseBoardFilter)
      ? (rawFilter as CaseBoardFilter)
      : "open";

    const all = await listCaseBoardItems();
    const cases = filterCaseBoardItems(all, filter);

    return NextResponse.json({ filter, cases, total: cases.length });
  } catch (error) {
    console.error("[api/property-manager/cases][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list cases" },
      { status: 500 },
    );
  }
}
