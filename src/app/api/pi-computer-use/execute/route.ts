import { NextResponse } from "next/server";
import { executePiComputerUseCommand } from "@/lib/pi/pi-computer-use-manager";
import { getPiComputerUseStatus } from "@/lib/pi/pi-computer-use-status";
import type { PiComputerUseCommand } from "@/lib/pi/pi-computer-use-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPiComputerUseCommand(value: unknown): value is PiComputerUseCommand {
  if (!value || typeof value !== "object" || !("action" in value)) {
    return false;
  }
  const action = (value as PiComputerUseCommand).action;
  return (
    action === "screenshot" ||
    action === "click" ||
    action === "double_click" ||
    action === "type" ||
    action === "hotkey" ||
    action === "scroll" ||
    action === "move" ||
    action === "active_window"
  );
}

export async function POST(request: Request) {
  const status = getPiComputerUseStatus();
  if (status.status !== "READY") {
    return NextResponse.json(
      {
        error: "PI computer use is not ready on this platform",
        status,
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPiComputerUseCommand(body)) {
    return NextResponse.json({ error: "Invalid PI computer use command" }, { status: 400 });
  }

  const receipt = await executePiComputerUseCommand(body);
  if (receipt.status === "blocked") {
    return NextResponse.json(
      {
        error: receipt.error ?? "PI computer use execution denied",
        receipt,
        status,
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ receipt, status });
}
