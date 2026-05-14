import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runComputerUseAction } from "../src/lib/computer-use/action-runner";
import { getCurrentOwner, retake } from "../src/lib/computer-use/control-lease";
import { getComputerUseStatus } from "../src/lib/computer-use/introspection";

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

async function main() {
  retake("USER", "Pointer indicate probe baseline");
  await runComputerUseAction({ name: "clear_indicators" });

  const point = await runComputerUseAction({
    name: "indicate_point",
    params: {
      position: { x: 120, y: 140 },
      label: "command input",
      ttlMs: 30_000,
    },
  });
  assert("indicate_point succeeds", point.success && point.status === "completed", point);
  assert(
    "active marker count after point is 1",
    getComputerUseStatus().pointerLayer.activeMarkers === 1,
    getComputerUseStatus().pointerLayer,
  );

  const highlight = await runComputerUseAction({
    name: "indicate_highlight",
    params: {
      position: { x: 320, y: 220 },
      width: 180,
      height: 96,
      label: "Voice Lab panel",
      ttlMs: 30_000,
    },
  });
  assert("indicate_highlight succeeds", highlight.success && highlight.status === "completed", highlight);
  assert(
    "active marker count after highlight is 2",
    getComputerUseStatus().pointerLayer.activeMarkers === 2,
    getComputerUseStatus().pointerLayer,
  );

  const malformed = await runComputerUseAction({
    name: "indicate_point",
    params: { position: { x: "bad", y: 1 } },
  });
  assert(
    "malformed indicate input fails honestly",
    !malformed.success && /MISSING_PARAM/.test(malformed.error ?? ""),
    malformed,
  );
  assert("USER remains in control", getCurrentOwner() === "USER", getCurrentOwner());

  const cleared = await runComputerUseAction({ name: "clear_indicators" });
  assert("clear_indicators succeeds", cleared.success && cleared.status === "completed", cleared);
  assert(
    "active marker count after clear is 0",
    getComputerUseStatus().pointerLayer.activeMarkers === 0,
    getComputerUseStatus().pointerLayer,
  );

  const files = [
    "src/lib/computer-use/indicate-layer.ts",
    "src/lib/computer-use/IndicateOverlay.tsx",
    "src/lib/computer-use/action-runner.ts",
  ];
  const source = files.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
  assert(
    "pointer modules contain no MouseEvent/KeyboardEvent/dispatchEvent injection",
    !/\b(?:MouseEvent|KeyboardEvent|dispatchEvent)\b/.test(source),
  );
  assert(
    "overlay declares pointer-events none",
    /pointerEvents:\s*"none"/.test(source),
  );
}

void main();
