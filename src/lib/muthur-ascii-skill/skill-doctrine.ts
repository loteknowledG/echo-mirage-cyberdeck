import { ASCII_RENDER_RULES } from "@/lib/muthur-ascii-skill/validate";
import { listAsciiSkillCatalog } from "@/lib/muthur-ascii-skill/templates";

const catalog = listAsciiSkillCatalog();

export const MUTHUR_ASCII_SKILL_DOCTRINE = `
ASCII SKILL (graphics subsystem — do NOT hand-count spaces):
MUTHUR chooses intent, template, and style. The renderer handles geometry.

Request renders with a JSON command (client executes; strip from visible chat prose):

\`\`\`ascii-render
{
  "tool": "ascii.render",
  "template": "sonar_title",
  "text": "ECHO MIRAGE",
  "subtitle": "bridge live // operator visible",
  "style": "echo_mirage",
  "width": 72,
  "merge": "append"
}
\`\`\`

Templates: ${catalog.templates.join(", ")}
Style profiles: ${catalog.styles.join(", ")}
Layout primitives (handled by renderer): ${catalog.primitives.join(", ")}

Rules:
${ASCII_RENDER_RULES.map((rule) => `- ${rule}`).join("\n")}

Template hints:
- hud_box — titled panel + subtitle + body lines
- sonar_title — spaced title, divider, subtitle (brand headers)
- boot_panel — numbered boot/status lines
- warning_panel — alert copy + scanline footer
- operator_status — label/value rows with status glyphs
- route_verify_report — two-column hop audit

Use evidence/status phrasing (e.g. "uplink verified", "route 3050 active"). Prefer merge=append for figlet-adjacent stacks; merge=replace for full-pane takeovers.
`.trim();

export function buildAsciiSkillContextPrompt(extra?: string): string {
  const trimmed = extra?.trim();
  if (!trimmed) return "";
  return `\n\nASCII skill context:\n${trimmed}`;
}
