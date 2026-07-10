import { messageReferencesLocalPath } from "@/lib/browser-intents";
import {
  isCasualMuthurChat,
  messageNeedsOperatorContext,
  shouldEnableMuthurTools,
} from "@/lib/muthur-core/muthur-chat-intent";
import { isCalyxMuthurToolsEnabled } from "@/lib/muthur/calyx/calyx-muthur-tools.server";
import { buildMuthurPiControlDoctrine } from "@/lib/muthur/control/muthur-control-doctrine";
import { isMuthurDirectPiComputerUseEnabled } from "@/lib/muthur/control/muthur-direct-pi-computer-use";
import {
  formatOperatorChatContextPrompt,
  isDocxFileName,
  isOperatorPaneEditRequest,
  type OperatorChatContext,
} from "@/lib/muthur/document-edit-intent";
import {
  buildOperatorDevWriteScopePrompt,
  resolveLocalFsWriteMode,
  resolveOperatorDevWriteRoot,
} from "@/lib/muthur/execution/localfs-write-scope.server";
import { WORKSPACE_ROOT } from "@/lib/muthur/execution/safety-policy";
import {
  buildMuthurPostureSystemPrompt,
  shouldEnableToolsForPosture,
  type MuthurPosture,
} from "@/lib/muthur/muthur-posture";
import {
  buildMuthurSelfModifyPrompt,
  isMuthurSelfModifyIntent,
} from "@/lib/muthur/muthur-self-modify-intent";
import { getLatestMuthurObservation } from "@/lib/muthur/observation/observation-store.server";
import { PI_COMPUTER_USE_DOCTRINE } from "@/lib/pi/pi-computer-use-doctrine";
import { buildSamusHandsEyesDoctrine } from "@/lib/samus-manus/hands-eyes-doctrine";
import { isSamusHandsEyesEnabled } from "@/lib/samus-manus/samus-manus-config.server";

const MUTHUR_COGNITION_DOCTRINE =
  "\n\nCOGNITION: You interpret operator intent and choose tools. The deck does not pre-run browser searches, file reads, or conversions from regex on the operator's message — call tools yourself (localfs, operator_browser, observe_operator_pane, etc.). Do not emit [GLYPH:...] unless the operator explicitly asked for a glyph render.";

function buildMuthurAvailableToolsPrompt(posture: MuthurPosture): string {
  const directPi = isMuthurDirectPiComputerUseEnabled();
  const calyx = isCalyxMuthurToolsEnabled();
  const handsEyes = isSamusHandsEyesEnabled();
  const devWriteRoot = resolveOperatorDevWriteRoot();
  const localFsWriteMode = resolveLocalFsWriteMode();
  const localFsWriteHint =
    localFsWriteMode === "open"
      ? "mkdir/write anywhere on operator disk (absolute paths like F:\\dev\\plasma) or /workspace/... for this repo."
      : devWriteRoot
        ? `mkdir/write inside the Echo Mirage repo or under ${devWriteRoot}.`
        : "mkdir/write only inside the Echo Mirage repo (serverless — no F:\\dev on Vercel).";
  const piTools =
    posture === "commander"
      ? "\n- request_pi_control_lease: Request operator grant for Pi desktop embodiment (mouse/keyboard/screen) before computer-use missions." +
        (directPi
          ? "\n- pi_computer_use: Execute one Synapse desktop action (screenshot, click, type, hotkey, scroll, move) under an active control lease."
          : "\n- delegate_pi_computer_use: Delegate approved missions to Pi under an active control lease.")
      : "";
  return (
    "\n\nAVAILABLE TOOLS:" +
    "\n- observe_operator_pane: Returns the current Monaco editor state in the Operator pane (file name, language, cursor, dirty, content excerpt)." +
    "\n- open_operator_file: Open a workspace text/markdown/code file in the operator Monaco editor on the operator's screen. Call before suggest_operator_edit when nothing is open." +
    "\n- suggest_operator_edit: Propose typed edits to markdown/code/text open in the operator Monaco editor. Edits auto-apply in the operator pane (Ctrl+Z to undo). Not for DOCX/PDF previews." +
    "\n- operator_browser: Operator web pane — goto URL or search query returns LIVE PAGE TEXT during tool rounds (server fetch); snapshot reads that page. Also queues the operator web pane. Do not loop snapshot — one goto + one snapshot max; then answer. For general knowledge without a specific URL, answer directly without browser." +
    "\n- localfs: REAL disk — read anywhere; " +
    localFsWriteHint +
    " Use write to create or update source files." +
    "\n- workspace_exec: REAL disk — allowlisted commands only (pnpm exec tsc --noEmit, pnpm lint, pnpm build, git diff, git log, etc.). Run after edits to verify." +
    "\n- git_status / git_diff: REAL disk — inspect repo changes after coding." +
    "\n- justbash: EPHEMERAL mirror only — rg/ls/cat search; writes do NOT persist. Never use for pnpm, git, or file changes." +
    "\n- clock: Server date/time." +
    (posture === "agent" && handsEyes
      ? "\n- samus_hands_eyes: Local Windows desktop control via samus-manus hands-eyes (pyautogui) — screenshot, click, type, hotkey, scroll, find-click. Agent direct embodiment."
      : "") +
    piTools +
    (calyx
      ? "\n- calyx_ingest / calyx_search / calyx_kernel_answer: Local Calyx vault (echo-mirage) for grounded ingest, multi-lens search, and kernel answers."
      : "") +
    "\n\nCODING ECHO MIRAGE (Phase A + B):" +
    "\n1. localfs write (or suggest_operator_edit for open operator files) to change code." +
    "\n2. git_status or git_diff to review changes." +
    "\n3. After file touches, MUTHUR auto-runs `git diff --stat` + `pnpm exec tsc --noEmit` and writes a receipt under `.muthur/receipts/coding/` — report PASS/FAIL from that receipt." +
    "\n4. You may still call workspace_exec for extra checks (lint, build) when asked." +
    "\n5. ECHO MIRAGE SELF-MODIFY: When the operator asks you to change this deck, your own code, or the Echo Mirage repo, that is authorized — use localfs on the workspace; do not refuse because the target is MUTHUR itself." +
    "\n\nIMPORTANT: When the user asks what is currently visible in the operator pane, call observe_operator_pane." +
    "\nWhen the user says open/read/show/view a specific file (e.g. L-ARCH-001.md), resolve that file — call open_operator_file with the path and localfs cat to read it. Do NOT call observe_operator_pane for document open commands." +
    "\nWhen they ask to edit a file and Monaco is not active, call open_operator_file with the path, then suggest_operator_edit (prefer replace_line_range for targeted edits). Edits apply immediately — confirm what changed; mention Ctrl+Z if they want to undo." +
    "\nWhen a file is already open in the operator pane, NEVER use localfs write on that file — only suggest_operator_edit." +
    "\nNever use justbash/find to locate the user's open document — use observe_operator_pane for the file already open in the operator pane."
  );
}

function buildDocumentEditHint(
  message: string,
  operatorContext: OperatorChatContext | null | undefined,
  posture: MuthurPosture,
): string {
  if (!isOperatorPaneEditRequest(message, operatorContext)) return "";

  if (posture === "plan") {
    return (
      "\n\nOPERATOR HINT: User mentioned a change but MUTHUR is in PLAN posture. " +
      "Brainstorm the approach and outline steps — do NOT call suggest_operator_edit, localfs, convert, or export. " +
      "Tell the operator to switch to Agent or Commander to apply changes."
    );
  }

  const ctxPath = operatorContext?.localFilePath?.trim() ?? "";
  const ctxName = operatorContext?.fileName?.trim() ?? "";
  const ctxSurface = operatorContext?.previewSurface ?? "";

  if (isDocxFileName(ctxName) || ctxSurface === "docx") {
    return (
      "\n\nOPERATOR HINT: User wants to edit a DOCX open in the operator pane. " +
      "Do NOT use justbash or localfs to search the filesystem. " +
      (ctxPath
        ? `Call convert_document_to_markdown with filePath "${ctxPath}", then suggest_operator_edit to remove/replace the requested text in the markdown.`
        : "Call convert_document_to_markdown on the open DOCX path, then suggest_operator_edit.") +
      " Tell the operator they can export back to DOCX when done."
    );
  }

  const obs = getLatestMuthurObservation("cyberdeck");
  const hasOpenDocument = Boolean(obs?.visibleDocument?.trim());
  const hasTextContext = Boolean(
    obs?.editor?.content?.trim() || obs?.documentExcerpt?.trim(),
  );
  if (!obs?.editor?.active && !(hasOpenDocument && hasTextContext)) {
    if (isDocxFileName(obs?.visibleDocument ?? null)) {
      return buildDocumentEditHint(
        message,
        {
          fileName: obs?.visibleDocument ?? undefined,
          previewSurface: "docx",
          localFilePath: obs?.editor?.filePath ?? undefined,
        },
        posture,
      );
    }
    return "\n\nOPERATOR HINT: User wants a document edit but no text editor is active. Open the file in the operator pane. For DOCX, convert to markdown first.";
  }
  const saveHint =
    posture === "agent" || posture === "commander"
      ? "Edits auto-save to disk when a writable path exists."
      : "Plan posture: observe and discuss only — switch to Agent or Commander to edit.";

  return (
    "\n\nOPERATOR HINT: User wants an in-pane edit on the open operator document. " +
    "Call observe_operator_pane, then suggest_operator_edit to remove/replace the requested text. " +
    "Do NOT use localfs write on a file already open in the operator pane — use suggest_operator_edit only. " +
    "For HTML comments or a single top line, use replace_line_range with startLine=1 endLine=1. " +
    `${saveHint} Confirm what changed; Ctrl+Z undoes in the operator pane. ` +
    "Do NOT search the filesystem with justbash."
  );
}

function buildEditorContextPrompt(): string {
  try {
    const obs = getLatestMuthurObservation("cyberdeck");
    if (!obs) return "";
    const e = obs.editor;
    if (!e || !e.active) return "";
    const lines = [
      `\n\nOperator pane editor state:`,
      `File: ${e.fileName ?? "unknown"}`,
      `Language: ${e.language ?? "unknown"}`,
      `Dirty: ${e.dirty ? "true" : "false"}`,
      e.cursorLine != null ? `Cursor: line ${e.cursorLine}, column ${e.cursorColumn ?? 1}` : null,
      `Content excerpt: ${e.contentExcerpt ?? e.content?.slice(0, 200) ?? "(empty)"}`,
    ].filter(Boolean);
    return lines.join("\n");
  } catch {
    return "";
  }
}

export type BuildMuthurSystemContentArgs = {
  message: string;
  operatorContext: OperatorChatContext | null;
  posture: MuthurPosture;
  commanderMissionActive?: boolean;
  memoryPrompt: string;
  browserPrompt: string;
  glyphPrompt: string;
  glyphDoctrine: string;
};

export type BuildMuthurSystemContentResult = {
  systemContent: string;
  toolsEnabled: boolean;
};

/** Posture, tools, operator hints, self-modify preamble for cyberdeck-chat system prompt. */
export function buildMuthurSystemContent(
  args: BuildMuthurSystemContentArgs,
): BuildMuthurSystemContentResult {
  const toolContext =
    typeof args.commanderMissionActive === "boolean"
      ? { missionActive: args.commanderMissionActive }
      : undefined;
  const toolsEnabled =
    shouldEnableMuthurTools(args.message) &&
    shouldEnableToolsForPosture(args.posture, args.message, toolContext);
  const needsOperator = messageNeedsOperatorContext(args.message, args.operatorContext);

  let systemContent =
    "You are MU/TH/UR 6000, the AI interface of the Echo Mirage Cyberdeck. Concise, technical, helpful.";

  systemContent += buildMuthurPostureSystemPrompt(args.posture);

  if (toolsEnabled) {
    systemContent += buildMuthurAvailableToolsPrompt(args.posture);
    systemContent += buildDocumentEditHint(args.message, args.operatorContext, args.posture);
    if (needsOperator) {
      systemContent += formatOperatorChatContextPrompt(args.operatorContext);
      systemContent += buildEditorContextPrompt();
    } else {
      systemContent +=
        "\n\nInterpret the operator's intent and call tools when an action is needed (read a path, browse the web, edit a file, run a command). Do not probe unprompted.";
    }
  } else if (isCasualMuthurChat(args.message)) {
    systemContent +=
      "\n\nReply conversationally. Tools are available if the operator asks for an action in the same turn.";
  } else {
    systemContent += "\n\nReply in plain text.";
  }

  systemContent += MUTHUR_COGNITION_DOCTRINE;
  systemContent += buildOperatorDevWriteScopePrompt(args.posture);
  if (isMuthurSelfModifyIntent(args.message)) {
    systemContent += buildMuthurSelfModifyPrompt(args.posture, WORKSPACE_ROOT);
  }
  if (toolsEnabled) {
    systemContent += buildSamusHandsEyesDoctrine(
      args.posture === "agent" && isSamusHandsEyesEnabled(),
    );
    const piDoctrine = buildMuthurPiControlDoctrine(args.posture);
    if (piDoctrine) {
      systemContent += piDoctrine;
      if (!isMuthurDirectPiComputerUseEnabled()) {
        systemContent += PI_COMPUTER_USE_DOCTRINE;
      }
    }
  }

  if (messageReferencesLocalPath(args.message)) {
    const writeMode = resolveLocalFsWriteMode();
    const planBlock =
      args.posture === "plan"
        ? " Plan posture cannot mkdir/write — tell the operator to switch to Agent (USE). Do NOT redirect to /workspace as a workaround."
        : "";
    systemContent +=
      "\n\nThe user referenced a local filesystem path. Use localfs ls/cat/stat on that path." +
      (writeMode === "open"
        ? " For new projects, use localfs mkdir + write with the absolute path they gave (Agent posture). Do NOT redirect to /workspace unless they asked for in-repo work."
        : writeMode === "dev-tree" && resolveOperatorDevWriteRoot()
          ? ` For new projects under ${resolveOperatorDevWriteRoot()}, use localfs mkdir + write in Agent posture.`
          : " Paths outside the Echo Mirage repo are read-only on this deployment.") +
      planBlock +
      " Do NOT search the web or open a browser for disk paths.";
  }

  systemContent += args.glyphDoctrine + args.memoryPrompt + args.browserPrompt + args.glyphPrompt;

  return { systemContent, toolsEnabled };
}
