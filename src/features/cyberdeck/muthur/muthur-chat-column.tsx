"use client";

import type { MouseEvent as ReactMouseEvent, Ref } from "react";
import { forwardRef } from "react";
import { MirageHeader } from "@/components/cyberdeck/mirage-header";
import {
  CyberdeckControlTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import { CyberdeckComposerControl } from "@/components/cyberdeck/cyberdeck-control-button";
import { MuthurCommanderStatus } from "@/components/cyberdeck/muthur-commander-status";
import { MuthurCommandConsoleLog } from "@/components/cyberdeck/muthur-command-console-log";
import {
  MuthurCommandInput,
  type MuthurCommandInputHandle,
} from "@/components/cyberdeck/muthur-command-input";
import { MuthurComposerVoiceKnob } from "@/components/cyberdeck/muthur-composer-voice-knob";
import { MuthurComposerShell } from "@/components/cyberdeck/muthur-composer-shell";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { MuthurDelegationPanel } from "@/components/cyberdeck/muthur-delegation-panel";
import { MuthurInhabitantRoller } from "@/components/cyberdeck/muthur-inhabitant-roller";
import { MuthurPostureRoller } from "@/components/cyberdeck/muthur-posture-roller";
import { renderGatewayMessageText } from "@/features/cyberdeck/gateway/gateway-message-render";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { DeckMode } from "@/lib/deck-mode";
import type {
  MuthurDiagnosticsState,
  MuthurResponseStall,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import type {
  MuthurDelegationAssignment,
  MuthurDelegationWorkerId,
} from "@/lib/muthur/delegation/muthur-delegation-types";
import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import {
  getMuthurInhabitantMeta,
  type MuthurInhabitant,
} from "@/lib/muthur/muthur-inhabitant";
import type { MuthurPosture } from "@/lib/muthur/muthur-posture";

export type MuthurChatColumnProps = {
  isMobileLayout: boolean;
  mirageHeaderCollapse: number;
  networkActivityActive: boolean;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  messageScrollRef: Ref<HTMLDivElement>;
  muthurChatScrollContentRef: Ref<HTMLDivElement>;
  messagesEndRef: Ref<HTMLDivElement>;
  onChatScroll: (element: HTMLDivElement) => void;
  muthurPosture: MuthurPosture;
  muthurMission: MuthurMission | null;
  isStreaming: boolean;
  onCreateMission: (input: { title: string; objective: string }) => void;
  onStartMission: () => void;
  messages: ChatMessage[];
  muthurDiagnostics: MuthurDiagnosticsState;
  streamText: string;
  streamToolTrace: string;
  streamReasoning: string;
  muthurStall: MuthurResponseStall | null;
  chatUserDisplayName: string;
  onChatUserDisplayNameChange: (name: string) => void;
  chatKeyboardHighlightIndex: number | null;
  cognitionStatusLine: string | null;
  muthurInhabitant: MuthurInhabitant;
  muthurDelegations: MuthurDelegationAssignment[];
  onCreateDelegation: (input: {
    workerId: MuthurDelegationWorkerId;
    title: string;
    objective: string;
    context: string;
    acceptanceCriteria: string[];
  }) => void;
  onDispatchDelegation: (assignmentId: string) => Promise<string | null>;
  onRecordDelegationResult: (
    assignmentId: string,
    input: { success: boolean; summary: string },
  ) => void;
  onCancelDelegation: (assignmentId: string) => void;
  deckMode: DeckMode;
  messageInputRef: Ref<MuthurCommandInputHandle>;
  inputHistory: string[];
  hasProviderAuth: boolean;
  glyphModeActive: boolean;
  chatHydrated: boolean;
  onSend: (messageText?: string) => void;
  onCanSendChange: (canSend: boolean) => void;
  onComposerFocusExtra: () => void;
  onPasteImage: (dataUrl: string) => void;
  connectionState: string;
  modelID: string;
  onModelLabelClick: () => void;
  onInhabitantChange: (inhabitant: MuthurInhabitant) => void;
  onPostureChange: (posture: MuthurPosture) => void;
  voiceEnabled: boolean;
  voiceHealth: "idle" | "backend" | "fallback" | "off";
  voiceVolume: number;
  onVoiceToggle: () => void;
  onVoiceVolumeChange: (volume: number) => void;
  canSendInput: boolean;
  onStop: () => void;
};

export const MuthurChatColumn = forwardRef<HTMLDivElement, MuthurChatColumnProps>(
  function MuthurChatColumn(props, ref) {
    const {
      isMobileLayout,
      mirageHeaderCollapse,
      networkActivityActive,
      onContextMenu,
      messageScrollRef,
      muthurChatScrollContentRef,
      messagesEndRef,
      onChatScroll,
      muthurPosture,
      muthurMission,
      isStreaming,
      onCreateMission,
      onStartMission,
      messages,
      muthurDiagnostics,
      streamText,
      streamToolTrace,
      streamReasoning,
      muthurStall,
      chatUserDisplayName,
      onChatUserDisplayNameChange,
      chatKeyboardHighlightIndex,
      cognitionStatusLine,
      muthurInhabitant,
      muthurDelegations,
      onCreateDelegation,
      onDispatchDelegation,
      onRecordDelegationResult,
      onCancelDelegation,
      deckMode,
      messageInputRef,
      inputHistory,
      hasProviderAuth,
      glyphModeActive,
      chatHydrated,
      onSend,
      onCanSendChange,
      onComposerFocusExtra,
      onPasteImage,
      connectionState,
      modelID,
      onModelLabelClick,
      onInhabitantChange,
      onPostureChange,
      voiceEnabled,
      voiceHealth,
      voiceVolume,
      onVoiceToggle,
      onVoiceVolumeChange,
      canSendInput,
      onStop,
    } = props;

    return (
      <div
        ref={ref}
        onContextMenu={onContextMenu}
        className={`cyberdeck-net-pane cyberdeck-chat-app left flex h-full max-h-full min-h-0 flex-col overflow-hidden bg-black max-md:min-h-0 md:min-w-0 md:border-b-0 md:border-l md:border-[#141414] ${
          networkActivityActive ? "is-net-active" : ""
        }`}
        data-cyberdeck-pane="muthur-chat"
      >
        {!isMobileLayout ? (
          <div className="border-b border-[#1a1a1a] px-2 py-1">
            <MirageHeader collapse={mirageHeaderCollapse} />
          </div>
        ) : null}
        <ResizablePanelGroup
          orientation="vertical"
          memoryKey="muthur-composer-split-v1"
          className="min-h-0 min-w-0 flex-1"
        >
          <ResizablePanel defaultSize={72} minSize={25} className="min-h-0 overflow-hidden">
            <div
              ref={messageScrollRef}
              tabIndex={-1}
              data-cyberdeck-scroll-y-only
              className="cyberdeck-chat-content custom-scrollbar flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden p-4 outline-none focus-visible:ring-1 focus-visible:ring-green-500/25"
              onScroll={(event) => {
                onChatScroll(event.currentTarget);
              }}
            >
              <div
                ref={muthurChatScrollContentRef}
                className="cyberdeck-chat-scroll-body min-h-0 min-w-0 max-w-full pb-6"
              >
                {isMobileLayout ? (
                  <div className="mb-2">
                    <MirageHeader collapse={mirageHeaderCollapse} />
                  </div>
                ) : null}
                <MuthurCommanderStatus
                  posture={muthurPosture}
                  mission={muthurMission}
                  disabled={isStreaming}
                  onCreateMission={onCreateMission}
                  onStartMission={onStartMission}
                  className="mb-3"
                />
                <MuthurCommandConsoleLog
                  messages={messages}
                  diagnosticsState={muthurDiagnostics}
                  streamText={streamText}
                  streamToolTrace={streamToolTrace}
                  streamReasoning={streamReasoning}
                  isStreaming={isStreaming}
                  responseStall={muthurStall}
                  chatUserDisplayName={chatUserDisplayName}
                  onChatUserDisplayNameChange={onChatUserDisplayNameChange}
                  chatKeyboardHighlightIndex={chatKeyboardHighlightIndex}
                  renderDiagnosticText={renderGatewayMessageText}
                  cognitionStatusLine={cognitionStatusLine}
                  streamInhabitant={muthurInhabitant}
                  delegationPanel={
                    muthurPosture === "commander" ? (
                      <MuthurDelegationPanel
                        variant="accordion"
                        mission={muthurMission}
                        assignments={muthurDelegations}
                        disabled={isStreaming}
                        onCreateDelegation={onCreateDelegation}
                        onDispatchDelegation={onDispatchDelegation}
                        onRecordDelegationResult={onRecordDelegationResult}
                        onCancelDelegation={onCancelDelegation}
                      />
                    ) : null
                  }
                />
                <div ref={messagesEndRef} className="h-px" aria-hidden />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle
            withHandle
            stacked
            data-cyberdeck-resizer="composer-split"
            aria-label="Resize MUTHUR message log and composer"
            className="cyberdeck-chat-resizer cyberdeck-composer-resizer !h-2 !min-h-2 !border-x-0 !border-y !border-[#141414] !bg-black hover:!border-red-500/70"
          />

          <ResizablePanel defaultSize={28} minSize={18} maxSize={75} className="min-h-0 overflow-hidden">
            <footer className="cyberdeck-message-box realmorphism-host-surface flex h-full min-h-0 flex-col border-t bg-black p-0">
              <div className="mx-2 mb-2 mt-2 flex min-h-0 flex-1 flex-col gap-2">
                <MuthurComposerShell deckMode={deckMode} className="flex min-h-0 flex-1 flex-col">
                  <div className="flex h-full min-h-0 flex-1 px-2 py-2" data-muthur-composer-input-band="">
                    <MuthurCommandInput
                      ref={messageInputRef}
                      inputHistory={inputHistory}
                      hasProviderAuth={muthurInhabitant === "muthur" ? hasProviderAuth : true}
                      glyphModeActive={glyphModeActive}
                      isStreaming={isStreaming}
                      chatHydrated={chatHydrated}
                      onSubmit={(text) => void onSend(text)}
                      onCanSendChange={onCanSendChange}
                      onFocusExtra={onComposerFocusExtra}
                      onPasteImage={onPasteImage}
                    />
                  </div>
                </MuthurComposerShell>
                <div className="muthur-composer-controls deck-pane-depth-toolbar shrink-0 px-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (muthurInhabitant === "muthur") {
                        onModelLabelClick();
                      }
                    }}
                    className={`min-w-0 shrink truncate text-[10px] font-mono ${
                      muthurInhabitant !== "muthur"
                        ? "text-amber-200"
                        : connectionState === "connected"
                          ? "text-green-300"
                          : connectionState === "connecting"
                            ? "text-amber-300"
                            : "text-gray-500"
                    } ${muthurInhabitant === "muthur" ? "cursor-pointer hover:underline" : "cursor-default"}`}
                    title={
                      muthurInhabitant === "muthur"
                        ? "Open provider connection panel"
                        : getMuthurInhabitantMeta(muthurInhabitant).title
                    }
                  >
                    {muthurInhabitant === "muthur"
                      ? modelID
                        ? modelID.split("/").pop()
                        : "NO_MODEL"
                      : getMuthurInhabitantMeta(muthurInhabitant).label.toUpperCase()}
                  </button>
                  <MuthurInhabitantRoller
                    inhabitant={muthurInhabitant}
                    disabled={isStreaming}
                    onChange={onInhabitantChange}
                  />
                  <MuthurPostureRoller
                    posture={muthurPosture}
                    disabled={muthurInhabitant !== "muthur" || isStreaming}
                    onChange={onPostureChange}
                  />
                </div>
                <div
                  className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1"
                  data-morphism="realmorphism"
                >
                  <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
                    <MuthurComposerVoiceKnob
                      voiceEnabled={voiceEnabled}
                      voiceHealth={voiceHealth}
                      voiceVolume={voiceVolume}
                      onVoiceToggle={onVoiceToggle}
                      onVoiceVolumeChange={onVoiceVolumeChange}
                    />
                    {!isStreaming ? (
                      <CyberdeckControlTooltip label="Send" disabled={!canSendInput}>
                        <CyberdeckComposerControl
                          control={{ size: "send", signal: canSendInput, off: !canSendInput }}
                          onClick={() => void onSend()}
                          disabled={!canSendInput}
                          aria-label="Send"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 transform-none transition-[color,opacity] duration-150 ease-out"
                          >
                            <path
                              d="M3 11.5L20.5 3.5L13.5 20.5L11.2 13.8L3 11.5Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M11.3 13.7L20.4 3.6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </CyberdeckComposerControl>
                      </CyberdeckControlTooltip>
                    ) : (
                      <>
                        {canSendInput ? (
                          <CyberdeckControlTooltip label="Steer — send now (interrupts current reply)">
                            <CyberdeckComposerControl
                              control={{ size: "send", signal: true }}
                              onClick={() => void onSend()}
                              aria-label="Steer MUTHUR"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="none"
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0"
                              >
                                <path
                                  d="M3 11.5L20.5 3.5L13.5 20.5L11.2 13.8L3 11.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M11.3 13.7L20.4 3.6"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </CyberdeckComposerControl>
                          </CyberdeckControlTooltip>
                        ) : null}
                        <CyberdeckControlTooltip label="Stop">
                          <CyberdeckComposerControl
                            control={{
                              size: "send",
                              amber: true,
                            }}
                            className={deckMode === "ascii" ? "is-latched" : undefined}
                            onClick={onStop}
                            aria-label="Stop"
                            aria-pressed
                          >
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                              <rect x="6.5" y="6.5" width="11" height="11" rx="1.2" />
                            </svg>
                          </CyberdeckComposerControl>
                        </CyberdeckControlTooltip>
                      </>
                    )}
                  </CyberdeckPaneTooltipProvider>
                </div>
              </div>
            </div>
              </div>
            </footer>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  },
);
