"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ChatUserRoleLabel } from "@/components/cyberdeck/chat-user-role-label";
import {
  collectMuthurToolHistory,
  countMuthurWords,
  extractMuthurProgressStatus,
  formatDiagnosticLabel,
  formatMuthurStreamBody,
  groupMuthurChatTurns,
  inhabitantChannelClass,
  isLongMuthurResponse,
  resolveMuthurAssistantLabel,
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
  formatInhabitantChannelLabel,
  normalizeMuthurInhabitant,
  type MuthurInhabitant,
} from "@/lib/muthur/muthur-inhabitant";
import {
  getMuthurNotifyAsciiClass,
  getMuthurNotifyAsciiLine,
  getMuthurNotifyBurstClass,
  getMuthurNotifyLiveClass,
  getMuthurNotifySettledClass,
  isMuthurNotifyMessage,
} from "@/lib/muthur-notify-style";
import { MuthurNotifyLine } from "@/components/cyberdeck/muthur-notify-line";
import { MuthurUplinkProgress } from "@/components/cyberdeck/muthur-uplink-progress";
import { isMuthurUplinkProgressOnly } from "@/lib/muthur-core/muthur-progress-phase";

type MuthurCommandConsoleLogProps = {
  messages: MuthurChatMessage[];
  diagnosticsState: MuthurDiagnosticsState;
  streamText: string;
  streamToolTrace: string;
  streamReasoning?: string;
  isStreaming: boolean;
  responseStall?: MuthurResponseStall | null;
  chatUserDisplayName: string;
  onChatUserDisplayNameChange: (name: string) => void;
  chatKeyboardHighlightIndex: number | null;
  renderDiagnosticText?: (text: string) => ReactNode;
  cognitionStatusLine?: string | null;
  delegationPanel?: ReactNode;
  streamInhabitant?: MuthurInhabitant;
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
  const isReasoning = /^\[REASONING\]/i.test(message.text.trim());
  return (
    <div className="py-0.5 font-mono text-[10px] leading-snug text-amber-200/80">
      <span
        className={
          isFailure
            ? "text-red-400/90"
            : isReasoning
              ? "text-violet-300/90"
            : isCognition
              ? "text-emerald-400/90"
              : "text-amber-500/90"
        }
      >
        [{label}]{" "}
      </span>
      <span
        className={`whitespace-pre-wrap ${
          isReasoning ? "text-violet-200/75" : isCognition ? "text-emerald-200/75" : "text-gray-400"
        }`}
      >
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
  streamReasoning = "",
  isStreaming,
  responseStall,
  chatUserDisplayName,
  onChatUserDisplayNameChange,
  chatKeyboardHighlightIndex,
  renderDiagnosticText,
  cognitionStatusLine,
  delegationPanel,
  streamInhabitant = "muthur",
}: MuthurCommandConsoleLogProps) {
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const turns = useMemo(() => groupMuthurChatTurns(messages), [messages]);
  const toolHistory = useMemo(() => collectMuthurToolHistory(turns), [turns]);
  const streamLabel = formatInhabitantChannelLabel(normalizeMuthurInhabitant(streamInhabitant));
  const streamLabelClass = inhabitantChannelClass(streamInhabitant);
  const diagnosticsPresentation = useMemo(
    () => presentMuthurDiagnostics(diagnosticsState),
    [diagnosticsState],
  );
  const diagnostics = diagnosticsPresentation.visible;
  const eventDiagnostics = useMemo(
    () =>
      diagnostics.filter((message) => {
        const label = formatDiagnosticLabel(message.text);
        return label !== "TOOLS" && label !== "REASONING";
      }),
    [diagnostics],
  );
  const archivedReasoning = useMemo(
    () => diagnostics.filter((message) => formatDiagnosticLabel(message.text) === "REASONING"),
    [diagnostics],
  );
  const liveToolTrace = streamToolTrace.trim();
  const liveReasoning = streamReasoning.trim();
  const accordionItemCount =
    diagnosticsPresentation.totalCount +
    toolHistory.length +
    archivedReasoning.length +
    (liveReasoning ? 1 : 0) +
    (liveToolTrace ? 1 : 0);
  const showDiagnosticsAccordion =
    accordionItemCount > 0 || Boolean(cognitionStatusLine?.trim());
  const streamBody = formatMuthurStreamBody(streamText);
  const progressStatus = extractMuthurProgressStatus(streamText);
  const progressOnly = isMuthurUplinkProgressOnly(streamText, streamBody);

  useEffect(() => {
    if (!showDiagnosticsAccordion) {
      setDiagnosticsExpanded(false);
    }
  }, [showDiagnosticsAccordion]);

  let rowIndex = 0;

  return (
    <>
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
                    {resolveMuthurAssistantLabel(turn.assistant)} response ·{" "}
                    {countMuthurWords(turn.assistant.text)} words
                  </div>
                ) : null}
                <span className={inhabitantChannelClass(turn.assistant.inhabitant)}>
                  [{resolveMuthurAssistantLabel(turn.assistant)}]{" "}
                </span>
                <span className="whitespace-pre-wrap text-gray-300">{turn.assistant.text}</span>
              </div>
            ) : null}
          </div>
        ))}

        {progressStatus && isStreaming && progressOnly ? (
          <MuthurUplinkProgress progressText={progressStatus} renderText={renderDiagnosticText} />
        ) : progressStatus && isStreaming ? (
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
                {streamLabel} composing · {countMuthurWords(streamBody)} words
              </div>
            ) : null}
            <span className={streamLabelClass}>[{streamLabel}] </span>
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

      {delegationPanel}

      {showDiagnosticsAccordion ? (
        <section
          data-muthur-diagnostics
          className="mt-4 min-w-0 max-w-full border-t border-[#1a1a1a] pt-3 pb-1"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left font-mono text-[10px] text-amber-500/90 hover:text-amber-400"
            aria-expanded={diagnosticsExpanded}
            onClick={() => setDiagnosticsExpanded((value) => !value)}
          >
            <span>{diagnosticsExpanded ? "▼" : "▶"}</span>
            <span>Diagnostics ({accordionItemCount})</span>
            {cognitionStatusLine && !diagnosticsExpanded ? (
              <span className="truncate text-emerald-500/70"> · cognition active</span>
            ) : null}
            {liveReasoning && !diagnosticsExpanded ? (
              <span className="truncate text-violet-400/70"> · reasoning</span>
            ) : null}
            {liveToolTrace && !diagnosticsExpanded ? (
              <span className="truncate text-cyan-500/70"> · tools</span>
            ) : null}
            {diagnosticsPresentation.collapsedSummary && !diagnosticsExpanded ? (
              <span className="truncate text-gray-500"> · collapsed</span>
            ) : null}
          </button>
          {diagnosticsExpanded ? (
            <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded border border-[#1a1a1a] bg-[#050505] p-2">
              {cognitionStatusLine ? (
                <DiagnosticLine
                  message={{ role: "system", text: cognitionStatusLine }}
                  renderDiagnosticText={renderDiagnosticText}
                />
              ) : null}

              {liveReasoning || archivedReasoning.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-violet-400/60">
                    Reasoning {isStreaming && liveReasoning ? "· live" : ""}
                  </p>
                  {liveReasoning ? (
                    <DiagnosticLine
                      message={{ role: "system", text: `[REASONING] ${liveReasoning}` }}
                      renderDiagnosticText={renderDiagnosticText}
                    />
                  ) : null}
                  {archivedReasoning.map((message, index) => (
                    <DiagnosticLine
                      key={`reasoning-${index}-${message.text.slice(0, 24)}`}
                      message={message}
                      renderDiagnosticText={renderDiagnosticText}
                    />
                  ))}
                </div>
              ) : null}

              {liveToolTrace || toolHistory.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-cyan-500/60">
                    Tool history
                  </p>
                  {liveToolTrace ? (
                    <DiagnosticLine
                      message={toolTraceToDiagnostic(liveToolTrace)}
                      renderDiagnosticText={renderDiagnosticText}
                    />
                  ) : null}
                  {toolHistory.map((message, index) => (
                    <DiagnosticLine
                      key={`tool-${index}-${message.text.slice(0, 24)}`}
                      message={message}
                      renderDiagnosticText={renderDiagnosticText}
                    />
                  ))}
                </div>
              ) : null}

              {eventDiagnostics.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-amber-500/60">
                    Events
                  </p>
                  {eventDiagnostics.map((message, index) => {
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
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
