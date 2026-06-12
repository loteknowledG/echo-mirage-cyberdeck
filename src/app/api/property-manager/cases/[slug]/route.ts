import { NextResponse } from "next/server";
import { loadCaseDetail } from "@/lib/property-manager/cases/reader.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const detail = await loadCaseDetail(decodeURIComponent(slug));
    if (!detail) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error("[api/property-manager/cases/[slug]][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load case" },
      { status: 500 },
    );
  }
}
