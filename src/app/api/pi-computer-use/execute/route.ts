import { NextResponse } from "next/server";
import {
  executePiComputerUseCommand,
} from "@/lib/pi/pi-computer-use-manager";
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
    action === "move"
  );
}

export async function POST(request: Request) {
  const status = getPiComputerUseStatus();
  if (status.computerUse !== "READY") {
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
  return NextResponse.json({ receipt, status });
}
