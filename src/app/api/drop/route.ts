import { NextRequest, NextResponse } from "next/server";
import { validateCreateDropInput } from "@/lib/dropbay/dropbay-jsonl-store";
import { intakeDrop, intakeDropFromFormData, parseDropQueryParams } from "@/lib/dropbay/dropbay-intake";
import type { CreateDropInput } from "@/lib/dropbay/dropbay-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_JSON_BYTES = 32_768;

async function readJsonBody(request: Request): Promise<CreateDropInput | NextResponse> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_JSON_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
  }

  try {
    return (await request.json()) as CreateDropInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const drop = await intakeDropFromFormData(form);
      return NextResponse.json({ ok: true, drop }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "Drop intake failed." },
        { status: 400 },
      );
    }
  }

  const body = await readJsonBody(request);
  if (body instanceof NextResponse) return body;

  const validationError = validateCreateDropInput(body);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  try {
    const drop = await intakeDrop(body);
    return NextResponse.json({ ok: true, drop }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Drop intake failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const input = parseDropQueryParams(request.nextUrl.searchParams);
  const validationError = validateCreateDropInput(input);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  try {
    const drop = await intakeDrop(input);
    return NextResponse.json({ ok: true, drop }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Drop intake failed." },
      { status: 500 },
    );
  }
}
