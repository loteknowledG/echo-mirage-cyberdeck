import { parseGlyphCommand } from "../src/lib/muthur-glyph-intent";
import { renderGlyph } from "../src/lib/glyph-render.server";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

assert("mode on", parseGlyphCommand("ascii mode")?.kind === "mode-on");
assert("glyph mode alias", parseGlyphCommand("glyph mode")?.kind === "mode-on");
assert("mode off", parseGlyphCommand("ascii off")?.kind === "mode-off");
assert("clear", parseGlyphCommand("ascii clear")?.kind === "clear");
assert("copy", parseGlyphCommand("ascii copy")?.kind === "copy");
const asciiText = parseGlyphCommand("ascii MUTHUR ONLINE");
assert(
  "ascii text",
  asciiText?.kind === "render" && asciiText.kind === "render" && asciiText.engine === "ascii",
);
const figletCmd = parseGlyphCommand("figlet ECHO MIRAGE");
assert("figlet", figletCmd?.kind === "render" && figletCmd.engine === "figlet");

async function run() {
  const rendered = await renderGlyph({ engine: "ascii", text: "TEST" });
  assert("render output", rendered.includes("⟁") && rendered.includes("TEST"));

  const figlet = await renderGlyph({ engine: "figlet", text: "ECHO", font: "ANSI Shadow" });
  assert("figlet banner", figlet.includes("FIGLET") && figlet.includes("ANSI Shadow"));
  assert("figlet art lines", figlet.split("\n").length > 6);

  console.log("\nAll MUTHUR glyph intent probes passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
