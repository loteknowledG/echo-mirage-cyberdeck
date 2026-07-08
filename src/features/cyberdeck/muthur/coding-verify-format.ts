import type { MuthurCodingVerifyReceipt } from "@/lib/muthur-core/types";

export function parseCodingVerifyHeader(raw: string | null): MuthurCodingVerifyReceipt | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as MuthurCodingVerifyReceipt;
    if (typeof parsed.passed === "boolean" && Array.isArray(parsed.touched_paths)) {
      return parsed;
    }
  } catch {
    /* ignore malformed header */
  }
  return null;
}

export function formatCodingVerifySystemLine(receipt: MuthurCodingVerifyReceipt): string {
  const status = receipt.passed ? "PASS" : "FAIL";
  const touched = receipt.touched_paths.join(", ") || "(none)";
  let line = `CODING_VERIFY // ${status} // tsc exit ${receipt.tsc_exit_code} // touched: ${touched}`;
  if (receipt.receipt_path) {
    line += ` // receipt: ${receipt.receipt_path}`;
  }
  if (!receipt.passed && receipt.tsc_stderr_tail.trim()) {
    line += ` // ${receipt.tsc_stderr_tail.trim().slice(0, 240)}`;
  }
  return line;
}

export {
  gatewayKeySysMessage,
  isGatewayKeySysTip,
  renderGatewayMessageText,
} from "@/features/cyberdeck/gateway/gateway-message-render";

export {
  buildCyberdeckChatHistory,
  type CyberdeckChatHistoryMessage,
} from "@/features/cyberdeck/muthur/build-chat-history";

export {
  contextMenuTargetIsTextField,
  textForSpeech,
} from "@/features/cyberdeck/shared/cyberdeck-ui-utils";

export {
  getOperatorFileKind,
  isEditableOperatorFile,
  readFileAsDataUrl,
  type DroppedOperatorAsset,
} from "@/features/cyberdeck/operator/operator-drop-utils";
