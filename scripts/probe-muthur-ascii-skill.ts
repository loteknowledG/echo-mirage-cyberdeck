import { renderAsciiSkill } from "../src/lib/muthur-ascii-skill/render.server";
import { extractAsciiRenderRequests, parseAsciiRenderOperatorInput } from "../src/lib/muthur-ascii-skill/parse-request";
import { parseGlyphResponseActions } from "../src/lib/muthur-glyph-intent";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

const sonarRequest = {
  tool: "ascii.render",
  template: "sonar_title",
  text: "ECHO MIRAGE",
  subtitle: "bridge live // operator visible",
  style: "echo_mirage",
  width: 72,
} as const;

const rendered = renderAsciiSkill(sonarRequest);
assert("sonar render ok", rendered.ok === true);
if (rendered.ok) {
  assert("sonar has box", rendered.output.includes("╭") && rendered.output.includes("╯"));
  assert("sonar has title", rendered.output.includes("E C H O"));
  assert("sonar has subtitle", rendered.output.includes("bridge live"));
  assert("sonar width bound", rendered.output.split("\n").every((line) => [...line].length <= 72));
}

const operatorStatus = renderAsciiSkill({
  tool: "ascii.render",
  template: "operator_status",
  title: "OPERATOR STATUS",
  style: "muthur",
  items: [
    { label: "UPLINK", value: "ACTIVE", status: "ok" },
    { label: "ROUTE", value: "3050", status: "warn" },
  ],
});
assert("operator_status ok", operatorStatus.ok === true);

const operatorCmd = parseAsciiRenderOperatorInput(
  'ascii render {"tool":"ascii.render","template":"boot_panel","title":"BOOT","style":"retro_terminal"}',
);
assert("operator ascii render json", operatorCmd?.template === "boot_panel");

const reply = `Here is your panel.

\`\`\`ascii-render
{"tool":"ascii.render","template":"warning_panel","title":"ANOMALY","subtitle":"review route","style":"alarm","width":60}
\`\`\`
`;
const parsed = parseGlyphResponseActions(reply);
assert("reply ascii-skill action", parsed.actions.some((action) => action.kind === "ascii-skill"));
assert("reply strips json fence", !parsed.displayText.includes("ascii-render"));

const extracted = extractAsciiRenderRequests(reply);
assert("extract one request", extracted.requests.length === 1);

console.log("\n--- sonar_title preview ---\n");
if (rendered.ok) console.log(rendered.output);
console.log("\nAll MUTHUR ASCII skill probes passed.");
