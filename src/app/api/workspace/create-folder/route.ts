import { NextRequest, NextResponse } from "next/server";
import { createWorkspaceFolder } from "@/lib/server/workspace-create-folder.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { parentPath?: unknown; folderName?: unknown };
    const parentPath = typeof body.parentPath === "string" ? body.parentPath : "";
    const folderName = typeof body.folderName === "string" ? body.folderName : "";
    if (!folderName.trim()) {
      return NextResponse.json({ success: false, error: "folderName is required." }, { status: 400 });
    }

    const result = await createWorkspaceFolder(parentPath, folderName);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, path: result.path });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Create folder failed." },
      { status: 500 },
    );
  }
}
