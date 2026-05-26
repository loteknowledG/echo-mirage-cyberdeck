import { NextResponse } from "next/server";
import { listAsciiSkillCatalog } from "@/lib/muthur-ascii-skill/templates";
import { renderAsciiSkill } from "@/lib/muthur-ascii-skill/render.server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    catalog: listAsciiSkillCatalog(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const result = renderAsciiSkill(body);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ascii.render failed" },
      { status: 500 },
    );
  }
}
