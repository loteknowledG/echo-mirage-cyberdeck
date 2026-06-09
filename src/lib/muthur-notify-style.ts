/** Race-strobe styling for MUTHUR chat notifications and uplink progress. */

export function isMuthurNotifyMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("⏳ MUTHUR")) return true;

  if (/TOOL FAILURE|CODING_VERIFY|OPERATOR OPEN|OPERATOR EDIT|OPERATOR CONVERT|POWERFIST OVERRIDE|MUTHUR_CONVERT/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function isMuthurNotifyFailure(text: string): boolean {
  return /TOOL FAILURE|CODING_VERIFY.*\/\/\s*FAIL|\bFAILED\b/i.test(text.trim());
}

/** Infinite sweep — live uplink progress only. */
export function getMuthurNotifyLiveClass(text: string): string | null {
  if (!text.trim().startsWith("⏳ MUTHUR")) return null;
  return "muthur-notify-race muthur-notify-race-live";
}

/** Finite burst — latest notification only. */
export function getMuthurNotifyBurstClass(text: string): string | null {
  if (!isMuthurNotifyMessage(text) || text.trim().startsWith("⏳ MUTHUR")) return null;
  if (isMuthurNotifyFailure(text)) {
    return "muthur-notify-race muthur-notify-race-burst muthur-notify-race-fail";
  }
  return "muthur-notify-race muthur-notify-race-burst muthur-notify-race-pass";
}

/** Static styling after burst completes. */
export function getMuthurNotifySettledClass(text: string): string {
  if (isMuthurNotifyFailure(text)) return "muthur-notify-settled-fail";
  return "muthur-notify-settled-pass";
}

export function findLatestMuthurNotifyIndex(messages: Array<{ role: string; text: string }>): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "system" && isMuthurNotifyMessage(message.text)) {
      return i;
    }
  }
  return -1;
}

/** Compact one-line ASCII ornament for a MUTHUR notification line. */
export function getMuthurNotifyAsciiLine(text: string): string | null {
  if (!isMuthurNotifyMessage(text)) return null;

  const trimmed = text.trim();

  if (trimmed.startsWith("⏳ MUTHUR")) {
    if (/uplink active/i.test(trimmed)) return "<<<---=={ UPLINK }==--->>>";
    if (/thinking/i.test(trimmed)) return "*~~[ COGITATE ]~~*";
    if (/tools:/i.test(trimmed)) return "<==[ TOOL RUN ]==>";
    if (/verify:/i.test(trimmed)) return "----[ VERIFY ]----";
    if (/composing final/i.test(trimmed)) return "*.*.* TRANSMIT *.*.*";
    if (/falling back/i.test(trimmed)) return ">>>[ FALLBACK ]<<<";
    return "---[ MUTHUR ]---";
  }

  if (/CODING_VERIFY/i.test(trimmed)) {
    return isMuthurNotifyFailure(trimmed)
      ? "!!!==[ TYPE FAIL ]==!!!"
      : "*.*.* BUILD VERIFIED *.*.*";
  }
  if (/OPERATOR OPEN/i.test(trimmed)) {
    return isMuthurNotifyFailure(trimmed) ? ">>>X OPEN DENIED X<<<" : "<==[ FILE OPEN ]==>";
  }
  if (/OPERATOR EDIT/i.test(trimmed)) return "===>[ PATCH ]===>";
  if (/OPERATOR CONVERT|MUTHUR_CONVERT/i.test(trimmed)) {
    return isMuthurNotifyFailure(trimmed) ? ">>>X CONVERT FAIL X<<<" : "<<<{ CONVERT }>>>";
  }
  if (/TOOL FAILURE/i.test(trimmed)) return "!!!==[ TOOL FAIL ]==!!!";
  if (/POWERFIST OVERRIDE/i.test(trimmed)) return "<===[ OVERRIDE ]===>";

  return "----[ SYS ]----";
}

export function getMuthurNotifyAsciiClass(text: string): string {
  if (isMuthurNotifyFailure(text)) {
    return "muthur-notify-ascii muthur-notify-ascii-fail";
  }
  if (text.trim().startsWith("⏳ MUTHUR")) {
    return "muthur-notify-ascii muthur-notify-ascii-live";
  }
  return "muthur-notify-ascii muthur-notify-ascii-pass";
}

/** @deprecated use isMuthurNotifyMessage + burst/settled helpers */
export function getMuthurNotifyRaceClass(text: string): string | null {
  return getMuthurNotifyLiveClass(text) ?? getMuthurNotifyBurstClass(text);
}
