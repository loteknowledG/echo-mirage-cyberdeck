import { isDocumentEditIntent } from "@/lib/muthur/document-edit-intent";

/** Greetings and small talk — reply directly, no tool rounds. */
export function isCasualMuthurChat(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");

  if (
    trimmed.length <= 48 &&
    /^(hi|hello|hey|yo|sup|greetings|good (morning|afternoon|evening|night))(\s+(muthur|mother|mu\/th\/ur|there|pickle))?[!?.\s]*$/i.test(
      lower,
    )
  ) {
    return true;
  }

  if (/^(thanks|thank you|thx|ok|okay|cool|nice|got it|understood|bye|goodbye)[!?.\s]*$/i.test(lower)) {
    return true;
  }

  return false;
}

/** Only inject operator/DOCX/editor hints when the message is about the pane or an edit. */
export function messageNeedsOperatorContext(message: string): boolean {
  if (isCasualMuthurChat(message)) return false;
  if (isDocumentEditIntent(message)) return true;

  const lower = message.toLowerCase();
  return (
    /\b(operator pane|operator panel|editor pane|monaco|open file|current file|active file|active document|this file|this doc)\b/.test(
      lower,
    ) ||
    /\b(docx|markdown|convert|export|suggest_operator_edit|observe_operator)\b/.test(lower) ||
    (/\b(what('| i)?s|show|read|summarize|inspect|look at)\b/.test(lower) &&
      /\b(pane|editor|document|file|doc)\b/.test(lower))
  );
}

export function shouldEnableMuthurTools(message: string): boolean {
  return !isCasualMuthurChat(message);
}
