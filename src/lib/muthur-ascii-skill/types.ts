export const ASCII_STYLE_PROFILES = [
  "weyland",
  "muthur",
  "echo_mirage",
  "retro_terminal",
  "alarm",
  "stealth",
] as const;

export type AsciiStyleProfile = (typeof ASCII_STYLE_PROFILES)[number];

export const ASCII_TEMPLATES = [
  "hud_box",
  "sonar_title",
  "boot_panel",
  "warning_panel",
  "operator_status",
  "route_verify_report",
] as const;

export type AsciiTemplate = (typeof ASCII_TEMPLATES)[number];

export type AsciiStatusLevel = "ok" | "warn" | "fail" | "pending";

export type AsciiStatusItem = {
  label: string;
  value: string;
  status?: AsciiStatusLevel;
};

export type AsciiRenderRequest = {
  tool: "ascii.render";
  template: AsciiTemplate;
  text?: string;
  title?: string;
  subtitle?: string;
  body?: string | string[];
  lines?: string[];
  items?: AsciiStatusItem[];
  style?: AsciiStyleProfile;
  width?: number;
  merge?: "append" | "replace";
};

export type AsciiRenderResult = {
  ok: true;
  output: string;
  width: number;
  template: AsciiTemplate;
  style: AsciiStyleProfile;
};

export type AsciiRenderError = {
  ok: false;
  error: string;
};

export type AsciiRenderResponse = AsciiRenderResult | AsciiRenderError;

export const ASCII_DEFAULT_WIDTH = 72;
export const ASCII_MIN_WIDTH = 32;
export const ASCII_MAX_WIDTH = 120;
