"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ChatUserRoleLabel } from "@/components/cyberdeck/chat-user-role-label";
import {
  countMuthurWords,
  extractMuthurProgressStatus,
  formatDiagnosticLabel,
  formatMuthurStreamBody,
  groupMuthurChatTurns,
  isLongMuthurResponse,
  toolTraceToDiagnostic,
  type MuthurChatMessage,
} from "@/lib/muthur-core/muthur-command-console";
import {
  buildMuthurStallMessage,
  presentMuthurDiagnostics,
  type MuthurDiagnosticsState,
  type MuthurResponseStall,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import {
  getMuthurNotifyAsciiClass,
  getMuthurNotifyAsciiLine,
  getMuthurNotifyBurstClass,
  getMuthurNotifyLiveClass,
  getMuthurNotifySettledClass,
  isMuthurNotifyMessage,
} from "@/lib/muthur-notify-style";
import { MuthurNotifyLine } from "@/components/cyberdeck/muthur-notify-line";

type MuthurCommandConsoleLogProps = {
  messages: MuthurChatMessage[];
  diagnosticsState: MuthurDiagnosticsState;
  streamText: string;
  streamToolTrace: string;
  isStreaming: boolean;
  responseStall?: MuthurResponseStall | null;
  chatUserDisplayName: string;
  onChatUserDisplayNameChange: (name: string) => void;
  chatKeyboardHighlightIndex: number | null;
  renderDiagnosticText?: (text: string) => ReactNode;
  isMobileLayout?: boolean;
  echoHeader?: ReactNode;
  cognitionStatusLine?: string | null;
};

function DiagnosticLine({
  message,
  renderDiagnosticText,
}: {
  message: MuthurChatMessage;
  renderDiagnosticText?: (text: string) => ReactNode;
}) {
  const label = formatDiagnosticLabel(message.text);
  const isFailure = /fail|error|invalid|rejected|timeout|abort/i.test(message.text);
  const isCognition = /^\[COGNITION/i.test(message.text.trim());
  return (
    <div className="py-0.5 font-mono text-[10px] leading-snug text-amber-200/80">
      <span
        className={
          isFailure
            ? "text-red-400/90"
            : isCognition
              ? "text-emerald-400/90"
              : "text-amber-500/90"
        }
      >
        [{label}]{" "}
      </span>
      <span className={`whitespace-pre-wrap ${isCognition ? "text-emerald-200/75" : "text-gray-400"}`}>
        {renderDiagnosticText ? renderDiagnosticText(message.text) : message.text}
      </span>
    </div>
  );
}

export function MuthurCommandConsoleLog({
  messages,
  diagnosticsState,
  streamText,
  streamToolTrace,
  isStreaming,
  responseStall,
  chatUserDisplayName,
  onChatUserDisplayNameChange,
  chatKeyboardHighlightIndex,
  renderDiagnosticText,
  isMobileLayout,
  echoHeader,
  cognitionStatusLine,
}: MuthurCommandConsoleLogProps) {
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const lastDiagnosticsCountRef = useRef(0);
  const turns = useMemo(() => groupMuthurChatTurns(messages), [messages]);
  const diagnosticsPresentation = useMemo(
    () => presentMuthurDiagnostics(diagnosticsState),
    [diagnosticsState],
  );
  const diagnostics = diagnosticsPresentation.visible;
  const diagnosticsTotalCount =
    diagnosticsPresentation.totalCount + (streamToolTrace && isStreaming ? 1 : 0);
  const streamBody = formatMuthurStreamBody(streamText);
  const progressStatus = extractMuthurProgressStatus(streamText);

  useEffect(() => {
    if (diagnosticsTotalCount === 0 && !cognitionStatusLine) {
      setDiagnosticsExpanded(false);
      lastDiagnosticsCountRef.current = 0;
      return;
    }
    if (isStreaming || diagnosticsTotalCount > lastDiagnosticsCountRef.current || cognitionStatusLine) {
      setDiagnosticsExpanded(true);
    }
    lastDiagnosticsCountRef.current = diagnosticsTotalCount;
  }, [cognitionStatusLine, diagnosticsTotalCount, isStreaming]);

  let rowIndex = 0;

  return (
    <>
      {isMobileLayout ? echoHeader : null}
      {responseStall ? (
        <div
          data-muthur-stall
          className="mb-2 rounded border border-red-900/60 bg-red-950/30 px-2 py-1 font-mono text-[10px] text-red-300/90"
        >
          {buildMuthurStallMessage(responseStall)}
        </div>
      ) : null}
      <section data-muthur-channel className="space-y-3">
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            {turn.user ? (
              <div
                data-chat-row={rowIndex++}
                className={`nav-row py-1 text-xs ${
                  chatKeyboardHighlightIndex === rowIndex - 1 ? "nav-row-kb-hover" : ""
                }`}
              >
                <ChatUserRoleLabel
                  displayName={chatUserDisplayName}
                  onDisplayNameChange={onChatUserDisplayNameChange}
                />
                <span className="whitespace-pre-wrap text-gray-300">{turn.user.text}</span>
              </div>
            ) : null}

            {turn.assistant ? (
              <div
                data-chat-row={rowIndex++}
                data-muthur-response
                className={`nav-row py-1 text-xs ${
                  chatKeyboardHighlightIndex === rowIndex - 1 ? "nav-row-kb-hover" : ""
                } ${isLongMuthurResponse(turn.assistant.text) ? "muthur-long-response" : ""}`}
              >
                {isLongMuthurResponse(turn.assistant.text) ? (
                  <div className="sticky top-0 z-10 -mx-1 mb-1 border-b border-green-900/50 bg-black/95 px-1 py-0.5 text-[10px] text-green-400/90">
                    MUTHUR response · {countMuthurWords(turn.assistant.text)} words
                  </div>
                ) : null}
                <span className="text-green-400">[MUTHUR] </span>
                <span className="whitespace-pre-wrap text-gray-300">{turn.assistant.text}</span>
              </div>
            ) : null}
          </div>
        ))}

        {progressStatus && isStreaming ? (
          <MuthurNotifyLine
            text={progressStatus}
            live
            renderText={renderDiagnosticText}
          />
        ) : null}

        {streamBody || (isStreaming && !progressStatus) ? (
          <div
            data-chat-row={rowIndex++}
            data-muthur-response
            data-muthur-latest-response
            className={`nav-row py-1 text-xs ${
              chatKeyboardHighlightIndex === rowIndex - 1 ? "nav-row-kb-hover" : ""
            } ${isLongMuthurResponse(streamBody) ? "muthur-long-response" : ""}`}
          >
            {isLongMuthurResponse(streamBody) ? (
              <div className="sticky top-0 z-10 -mx-1 mb-1 border-b border-green-900/50 bg-black/95 px-1 py-0.5 text-[10px] text-green-400/90">
                MUTHUR composing · {countMuthurWords(streamBody)} words
              </div>
            ) : null}
            <span className="text-green-400">[MUTHUR] </span>
            <span className="text-gray-300">
              {streamBody ? (
                <span className="whitespace-pre-wrap">{streamBody}</span>
              ) : (
                <span className="text-green-300/80">…</span>
              )}
              {isStreaming ? <span className="animate-pulse text-green-400"> █</span> : null}
            </span>
          </div>
        ) : null}
      </section>

      {diagnosticsTotalCount > 0 || streamToolTrace || cognitionStatusLine ? (
        <section data-muthur-diagnostics className="mt-4 border-t border-[#1a1a1a] pt-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left font-mono text-[10px] text-amber-500/90 hover:text-amber-400"
            aria-expanded={diagnosticsExpanded}
            onClick={() => setDiagnosticsExpanded((value) => !value)}
          >
            <span>{diagnosticsExpanded ? "▼" : "▶"}</span>
            <span>Diagnostics ({diagnosticsTotalCount})</span>
            {cognitionStatusLine && !diagnosticsExpanded ? (
              <span className="truncate text-emerald-500/70"> · cognition active</span>
            ) : null}
            {diagnosticsPresentation.collapsedSummary && !diagnosticsExpanded ? (
              <span className="truncate text-gray-500"> · collapsed</span>
            ) : null}
          </button>
          {diagnosticsExpanded ? (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-[#1a1a1a] bg-[#050505] p-2">
              {cognitionStatusLine ? (
                <DiagnosticLine
                  message={{ role: "system", text: cognitionStatusLine }}
                  renderDiagnosticText={renderDiagnosticText}
                />
              ) : null}
              {isStreaming && streamToolTrace ? (
                <DiagnosticLine
                  message={toolTraceToDiagnostic(streamToolTrace)}
                  renderDiagnosticText={renderDiagnosticText}
                />
              ) : null}
              {diagnostics.map((message, index) => {
                const notifyAscii = getMuthurNotifyAsciiLine(message.text);
                const burstClass = isMuthurNotifyMessage(message.text)
                  ? getMuthurNotifyBurstClass(message.text)
                  : null;
                const settledClass =
                  !burstClass && isMuthurNotifyMessage(message.text)
                    ? getMuthurNotifySettledClass(message.text)
                    : null;
                const liveClass = getMuthurNotifyLiveClass(message.text);
                return (
                  <div key={`${index}-${message.text.slice(0, 24)}`}>
                    {notifyAscii ? (
                      <span className={getMuthurNotifyAsciiClass(message.text)}>{notifyAscii}</span>
                    ) : null}
                    <div className={burstClass ?? settledClass ?? liveClass ?? undefined}>
                      <DiagnosticLine message={message} renderDiagnosticText={renderDiagnosticText} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
