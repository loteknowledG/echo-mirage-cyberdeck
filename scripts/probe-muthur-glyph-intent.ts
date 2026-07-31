import {
  parseGlyphCommand,
  parseGlyphNaturalLanguageIntent,
  parseGlyphResponseActions,
  resolveGlyphCommand,
  isOperatorAsciiArtRequest,
} from "../src/lib/muthur-glyph-intent";
import { buildAsciiArtExecutionPrompt } from "../src/lib/muthur-glyph-doctrine";
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
assert("edit", parseGlyphCommand("ascii edit")?.kind === "edit-on");
assert("view", parseGlyphCommand("ascii view")?.kind === "edit-off");
const asciiText = parseGlyphCommand("ascii MUTHUR ONLINE");
assert(
  "ascii text",
  asciiText?.kind === "render" && asciiText.kind === "render" && asciiText.engine === "ascii",
);
const figletCmd = parseGlyphCommand("figlet ECHO MIRAGE");
assert("figlet", figletCmd?.kind === "render" && figletCmd.engine === "figlet");

const figletFont = parseGlyphCommand('figlet --font Impossible ECHO MIRAGE');
assert(
  "figlet font flag",
  figletFont?.kind === "render" &&
    figletFont.engine === "figlet" &&
    figletFont.font === "Impossible" &&
    figletFont.text === "ECHO MIRAGE",
);

const muthurPrefix = parseGlyphCommand("muthur, figlet ECHO");
assert("muthur prefix", muthurPrefix?.kind === "render" && muthurPrefix.engine === "figlet");

const nl = parseGlyphNaturalLanguageIntent("render ECHO MIRAGE in Impossible font");
assert(
  "natural language figlet",
  nl?.kind === "render" && nl.engine === "figlet" && nl.text === "ECHO MIRAGE",
);

const resolved = resolveGlyphCommand("make a figlet banner for TEST");
assert(
  "resolve banner",
  resolved?.kind === "render" && resolved.engine === "figlet" && resolved.text === "TEST",
);

const glyphReply = parseGlyphResponseActions(
  'Try Impossible.\n[GLYPH:engine=figlet text="ECHO" font=Impossible merge=append]',
);
assert("glyph directive parsed", glyphReply.actions.length === 1);
assert("glyph directive stripped", !glyphReply.displayText.includes("[GLYPH:"));

const asciiFenceReply = parseGlyphResponseActions(
  "Here's your cat.\n```ascii\n /\\_/\\\n( o.o )\n > ^ <\n```",
);
assert("ascii fence auto-applied", asciiFenceReply.actions.length === 1);
assert(
  "ascii fence content",
  asciiFenceReply.actions[0]?.kind === "set" &&
    asciiFenceReply.actions[0]?.text.includes("/\\_/\\"),
);
assert("ascii fence stripped from chat", !asciiFenceReply.displayText.includes("/\\_/\\"));

assert("operator ascii art intent", isOperatorAsciiArtRequest("draw me a cat in ascii art"));
assert(
  "ascii execution prompt",
  buildAsciiArtExecutionPrompt("figlet HELLO").includes("ascii-render"),
);

async function run() {
  const rendered = await renderGlyph({ engine: "ascii", text: "TEST", decorate: true });
  assert("render output", rendered.includes("⟁") && rendered.includes("TEST"));

  const figlet = await renderGlyph({
    engine: "figlet",
    text: "ECHO",
    font: "ANSI Shadow",
    decorate: true,
  });
  assert("figlet banner", figlet.includes("FIGLET") && figlet.includes("ANSI Shadow"));
  assert("figlet art lines", figlet.split("\n").length > 6);

  console.log("\nAll MUTHUR glyph intent probes passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
