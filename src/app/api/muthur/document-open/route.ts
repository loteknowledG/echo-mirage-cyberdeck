import { NextRequest, NextResponse } from "next/server";

import {
  parseDocumentOpenIntent,
  type DocumentOpenVerb,
} from "@/lib/muthur-document-open-intent";
import {
  buildDocumentOpenResult,
  resolveDocumentReference,
} from "@/lib/server/muthur-document-open.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocumentOpenBody = {
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DocumentOpenBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ handled: false, error: "message is required" }, { status: 400 });
    }

    const intent = parseDocumentOpenIntent(message);
    if (!intent) {
      return NextResponse.json({ handled: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const workspaceRoot = process.cwd();
    const resolution = resolveDocumentReference(intent.target, workspaceRoot);
    const result = buildDocumentOpenResult({
      verb: intent.verb,
      target: intent.target,
      resolution,
      workspaceRoot,
    });

    return NextResponse.json(
      {
        handled: true,
        response: result.response,
        receipt: result.receipt,
        operator_open: result.operatorOpen,
        resolution: {
          status: resolution.status,
          relative_path: resolution.relativePath ?? null,
          basename: resolution.basename,
        },
        read_only: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Document open failed";
    return NextResponse.json({ handled: false, error: message }, { status: 500 });
  }
}

export type { DocumentOpenVerb };
