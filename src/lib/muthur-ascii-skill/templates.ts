import { box, center, columns, insetLine, line, scanline, visibleLength, wrap } from "@/lib/muthur-ascii-skill/primitives";
import { resolveStyleProfile, type StyleConfig } from "@/lib/muthur-ascii-skill/styles";
import type { AsciiRenderRequest, AsciiStatusItem } from "@/lib/muthur-ascii-skill/types";
import { normalizeAsciiWidth } from "@/lib/muthur-ascii-skill/validate";

function innerWidth(width: number): number {
  return Math.max(8, width - 2);
}

function contentWidth(width: number, pad: string): number {
  return Math.max(8, innerWidth(width) - pad.length);
}

function panelLine(text: string, width: number, style: StyleConfig): string {
  return insetLine(text, innerWidth(width), style.innerPad);
}

function bodyLines(request: AsciiRenderRequest): string[] {
  if (Array.isArray(request.body)) return request.body;
  if (typeof request.body === "string") return request.body.split("\n");
  if (request.lines?.length) return request.lines;
  return [];
}

function statusRows(items: AsciiStatusItem[], style: StyleConfig, width: number): string[] {
  const usable = contentWidth(width, style.innerPad);
  const labelWidth = Math.min(22, Math.floor(usable * 0.42));
  return items.map((item) => {
    const glyph = style.statusGlyph[item.status ?? "pending"];
    const label = item.label.slice(0, labelWidth);
    const value = item.value;
    const left = `${glyph} ${label}`.padEnd(labelWidth + 6, " ");
    const row = `${left}${value}`;
    return panelLine(row.slice(0, usable), width, style);
  });
}

function renderHudBox(request: AsciiRenderRequest, style: StyleConfig, width: number): string[] {
  const usable = contentWidth(width, style.innerPad);
  const title = style.titleTransform(request.title ?? request.text ?? "HUD PANEL");
  const rows = [
    panelLine(title, width, style),
    panelLine(line(Math.min(usable, visibleLength(title) + 4), style.divider), width, style),
    ...wrap(request.subtitle ?? "operator channel // standing by", usable).map((row) =>
      panelLine(row, width, style),
    ),
    ...bodyLines(request).flatMap((row) =>
      wrap(row, usable).map((wrapped) => panelLine(wrapped, width, style)),
    ),
  ];
  return box(rows, width, style.box);
}

function renderSonarTitle(request: AsciiRenderRequest, style: StyleConfig, width: number): string[] {
  const usable = contentWidth(width, style.innerPad);
  const title = style.titleTransform(request.text ?? request.title ?? "SONAR");
  const subtitle = request.subtitle ?? "signal acquired // channel open";
  const rows = [
    panelLine(title, width, style),
    panelLine(line(Math.min(usable, 20), style.divider), width, style),
    ...wrap(subtitle, usable).map((row) => panelLine(row, width, style)),
  ];
  return box(rows, width, style.box);
}

function renderBootPanel(request: AsciiRenderRequest, style: StyleConfig, width: number): string[] {
  const usable = contentWidth(width, style.innerPad);
  const title = style.titleTransform(request.title ?? request.text ?? "BOOT SEQUENCE");
  const lines = bodyLines(request);
  const bootLines =
    lines.length > 0
      ? lines
      : [
          `${style.accent}core online`,
          "memory atlas linked",
          "glyph channel ready",
          "operator uplink verified",
        ];
  const rows = [
    panelLine(title, width, style),
    panelLine(line(usable, style.divider), width, style),
    ...bootLines.flatMap((row, index) =>
      wrap(`${index + 1}. ${row}`, usable).map((wrapped) => panelLine(wrapped, width, style)),
    ),
  ];
  return box(rows, width, style.box);
}

function renderWarningPanel(request: AsciiRenderRequest, style: StyleConfig, width: number): string[] {
  const usable = contentWidth(width, style.innerPad);
  const title = style.titleTransform(request.title ?? request.text ?? "WARNING");
  const body = request.subtitle ?? request.body ?? "anomaly detected // review required";
  const bodyText = typeof body === "string" ? body : body.join("\n");
  const rows = [
    panelLine(`${style.accent}${title}`, width, style),
    panelLine(line(usable, "!"), width, style),
    ...wrap(bodyText, usable).map((row) => panelLine(row, width, style)),
    panelLine(scanline(usable), width, style),
  ];
  return box(rows, width, style.box);
}

function renderOperatorStatus(request: AsciiRenderRequest, style: StyleConfig, width: number): string[] {
  const title = style.titleTransform(request.title ?? request.text ?? "OPERATOR STATUS");
  const items =
    request.items ??
    [
      { label: "UPLINK", value: "ACTIVE", status: "ok" as const },
      { label: "MEMORY", value: "LINKED", status: "ok" as const },
      { label: "GLYPH", value: "READY", status: "pending" as const },
    ];
  const usable = contentWidth(width, style.innerPad);
  const rows = [
    panelLine(title, width, style),
    panelLine(line(usable, style.divider), width, style),
    ...statusRows(items, style, width),
  ];
  return box(rows, width, style.box);
}

function renderRouteVerifyReport(request: AsciiRenderRequest, style: StyleConfig, width: number): string[] {
  const usable = contentWidth(width, style.innerPad);
  const title = style.titleTransform(request.title ?? request.text ?? "ROUTE VERIFY");
  const subtitle = request.subtitle ?? "path evidence // hop audit";
  const left =
    request.items?.map((item) => `${item.label}`.slice(0, 18)) ??
    ["ORIGIN", "GATEWAY", "PROVIDER", "PANE"];
  const right =
    request.items?.map((item) => `${style.statusGlyph[item.status ?? "ok"]} ${item.value}`) ??
    ["LOCAL", "3050", "ACTIVE", "GLYPH"];
  const paired = columns(left, right, usable, 2);
  const rows = [
    panelLine(title, width, style),
    panelLine(line(usable, style.divider), width, style),
    panelLine(subtitle, width, style),
    panelLine(line(usable, "·"), width, style),
    ...paired.map((row) => panelLine(row, width, style)),
  ];
  return box(rows, width, style.box);
}

export function renderAsciiTemplate(request: AsciiRenderRequest): string[] {
  const width = normalizeAsciiWidth(request.width);
  const style = resolveStyleProfile(request.style);

  switch (request.template) {
    case "hud_box":
      return renderHudBox(request, style, width);
    case "sonar_title":
      return renderSonarTitle(request, style, width);
    case "boot_panel":
      return renderBootPanel(request, style, width);
    case "warning_panel":
      return renderWarningPanel(request, style, width);
    case "operator_status":
      return renderOperatorStatus(request, style, width);
    case "route_verify_report":
      return renderRouteVerifyReport(request, style, width);
    default:
      return box(
        [panelLine(center(request.text ?? "ASCII", innerWidth(width)), width, style)],
        width,
        style.box,
      );
  }
}

export function listAsciiSkillCatalog(): {
  templates: string[];
  styles: string[];
  primitives: string[];
} {
  return {
    templates: [
      "hud_box",
      "sonar_title",
      "boot_panel",
      "warning_panel",
      "operator_status",
      "route_verify_report",
    ],
    styles: ["weyland", "muthur", "echo_mirage", "retro_terminal", "alarm", "stealth"],
    primitives: ["box", "line", "center", "pad", "wrap", "columns", "wave", "cable", "glitch", "scanline"],
  };
}
