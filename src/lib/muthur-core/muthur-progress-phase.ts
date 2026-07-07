export type MuthurUplinkProgressKind =
  | "uplink"
  | "thinking"
  | "tools"
  | "verify"
  | "transmit"
  | "working";

export type MuthurUplinkProgressPhase = {
  kind: MuthurUplinkProgressKind;
  /** Short uppercase phase for the progress chrome (not an assistant reply). */
  title: string;
  /** Human detail without the ⏳ prefix. */
  detail: string;
  ascii: string;
};

export function parseMuthurUplinkProgressPhase(text: string): MuthurUplinkProgressPhase {
  const trimmed = text.trim();
  const detail = trimmed.replace(/^⏳\s*/, "");

  if (/preparing uplink/i.test(trimmed)) {
    return { kind: "uplink", title: "UPLINK", detail, ascii: "<<<---=={ UPLINK }==--->>>" };
  }
  if (/uplink active/i.test(trimmed)) {
    return { kind: "uplink", title: "UPLINK", detail, ascii: "<<<---=={ UPLINK }==--->>>" };
  }
  if (/thinking/i.test(trimmed)) {
    return { kind: "thinking", title: "COGITATING", detail, ascii: "*~~[ COGITATE ]~~*" };
  }
  if (/tools:/i.test(trimmed)) {
    return { kind: "tools", title: "TOOL RUN", detail, ascii: "<==[ TOOL RUN ]==>" };
  }
  if (/verify:/i.test(trimmed)) {
    return { kind: "verify", title: "VERIFY", detail, ascii: "----[ VERIFY ]----" };
  }
  if (/composing final/i.test(trimmed)) {
    return {
      kind: "transmit",
      title: "TRANSMITTING",
      detail,
      ascii: "*.*.* TRANSMIT *.*.*",
    };
  }
  if (/retrying with tool nudge/i.test(trimmed)) {
    return { kind: "thinking", title: "RETRY", detail, ascii: "*~~[ COGITATE ]~~*" };
  }
  return { kind: "working", title: "WORKING", detail, ascii: "---[ MUTHUR ]---" };
}

/** True when the stream has only uplink progress lines — no assistant body yet. */
export function isMuthurUplinkProgressOnly(streamText: string, streamBody: string): boolean {
  if (!streamText.trim()) return false;
  if (streamBody.trim()) return false;
  return /^⏳ MUTHUR/m.test(streamText.trim());
}
