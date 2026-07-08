"use client";

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import {
  createUplinkTimeout,
  postCyberdeckChatUplink,
  readCyberdeckChatStream,
} from "@/lib/muthur-core/muthur-chat-client";
import {
  looksLikeCaptchaBlock,
  messageReferencesLocalPath,
  parseBrowserCommand,
  type BrowserCommand,
} from "@/lib/browser-intents";
import { isMuthurSelfModifyIntent } from "@/lib/muthur/muthur-self-modify-intent";
import { loadComputerUse } from "@/features/cyberdeck/runtime/defer-computer-use";
import { playDeckWrongDoorShut } from "@/features/cyberdeck/runtime/defer-deck-audio";
import {
  formatMuthurLiveStreamDisplay,
  MUTHUR_UPLINK_PREPARING,
  resolveMuthurCommittedDisplayText,
  splitMuthurStreamPayload,
} from "@/lib/muthur-core/muthur-stream-payload";
import { toolTraceToDiagnostic } from "@/lib/muthur-core/muthur-command-console";
import {
  extractMuthurStreamReasoning,
  formatMuthurReasoningDiagnostic,
} from "@/lib/muthur-core/muthur-stream-reasoning";
import {
  appendMuthurDiagnosticBatch,
  appendMuthurDiagnosticEntry,
  type MuthurDiagnosticsState,
  type MuthurResponseStall,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import { parseOperatorConversionJson } from "@/lib/muthur-core/operator-conversion-ref";
import { parseOperatorBrowserJson } from "@/lib/muthur-core/operator-browser-ref";
import { parseSurveyAutoConnectJson } from "@/lib/muthur-core/survey-auto-connect-ref";
import { parseOperatorOpenJson } from "@/lib/muthur-core/operator-open-file-ref";
import type { MuthurOperatorOpenFileRef } from "@/lib/muthur-core/types";
import { parseGlyphResponseActions } from "@/lib/muthur-glyph-intent";
import {
  isDocumentEditIntent,
  isOperatorPaneEditRequest,
} from "@/lib/muthur/document-edit-intent";
import {
  applyMuthurOperatorEdits,
  parseOperatorEditsHeader,
  pathsReferToSameOperatorFile,
  reloadOperatorDocumentFromWorkspacePath,
  waitForOperatorDocumentReady,
} from "@/lib/operator-muthur-edit";
import {
  buildMuthurMemoryContext,
  recordMuthurMemoryTurn,
  type MuthurMemoryState,
} from "@/lib/muthur-memory";
import { persistMuthurShipMemoryTurn } from "@/lib/muthur-ship-memory";
import {
  formatInhabitantChannelLabel,
  type MuthurInhabitant,
} from "@/lib/muthur/muthur-inhabitant";
import { sendMuthurInhabitantMessage } from "@/lib/muthur/muthur-inhabitant-chat.client";
import { resolveOperatorAssetSurface } from "@/lib/operator-file-surface";
import { detectComputerUseMission } from "@/lib/muthur/control/computer-use-intent";
import { isPiControlLeaseUiGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating.client";
import { parsePiControlLeaseStreamMarker } from "@/lib/muthur/control/pi-control-lease-stream";
import type { PiControlLeaseRequest } from "@/lib/muthur/control/pi-control-lease-types";
import type { usePiControlLease } from "@/lib/muthur/control/use-pi-control-lease";
import { queuePiMission } from "@/lib/pi/pi-mission-bridge";
import { summarizeMuthurOperatorEdits } from "@/lib/muthur-operator-edit-summary";
import {
  shouldAutoCommitOperatorEdits,
  type MuthurPosture,
} from "@/lib/muthur/muthur-posture";
import {
  canExecuteCommanderMissionWork,
  type MuthurMission,
} from "@/lib/muthur/mission/muthur-mission-types";
import {
  cognitionFromMemoryContext,
  cognitionFromUserMessage,
} from "@/lib/muthur/cognition/muthur-cognition-events";
import type { MuthurCognitionEmitInput } from "@/lib/muthur/cognition/muthur-cognition-types";
import { appendSurveyChatMessage } from "@/lib/cyberdeck/survey-chat";
import {
  executeSurveyHubConnectForMuthur,
  surveyAutoConnectFailureMessage,
} from "@/lib/cyberdeck/survey-muthur-connect.client";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { flushMuthurObservation } from "@/lib/muthur/observation/publish-observation";
import { parseFoundationQuery } from "@/lib/muthur-foundation-intent";
import { parseAionQuery } from "@/lib/muthur-aion-intent";
import { parseDocumentOpenIntent } from "@/lib/muthur-document-open-intent";
import {
  formatProviderReceiptDiagnostic,
  resolveOutboundProviderCredentials,
} from "@/lib/provider-credentials";
import { formatPiScreenContextForMuthur, readPiScreenSnapshot } from "@/lib/pi-screen-context";
import { buildGlyphContextSnapshot } from "@/lib/glyph-channel";
import { canSaveOperatorDocumentInPlace } from "@/lib/operator-save";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import {
  buildCyberdeckChatHistory,
  formatCodingVerifySystemLine,
  parseCodingVerifyHeader,
  type DroppedOperatorAsset,
} from "@/features/cyberdeck/muthur/coding-verify-format";
import {
  isUnassignedCustomTab,
  parseCustomTabCommand,
  type CustomTab,
  type CustomTabKind,
} from "@/features/cyberdeck/workspace/custom-tab-model";
import type { OperatorDocFolderRoot } from "@/lib/operator-folder-nav";
import type { MuthurCommandInputHandle } from "@/components/cyberdeck/muthur-command-input";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";

/** Cooldown applied to a provider after a 429 rate-limit response. */
const PROVIDER_RATE_LIMIT_COOLDOWN_MS = 90_000;

type SteerPending = {
  userMessage: string;
  options?: { preserveSelectedSurface?: boolean; surveyMission?: boolean };
} | null;

type ModelFetchStatus = "idle" | "retrieving" | "invalid-key" | "error" | "ready";

export type HandleSendOptions = {
  preserveSelectedSurface?: boolean;
  surveyMission?: boolean;
};

export type HandleSend = (
  messageText?: string,
  options?: HandleSendOptions,
  sendOptions?: { skipAppendUser?: boolean },
) => Promise<void>;

export type UseMuthurChatSendOptions = {
  // chat state
  messages: ChatMessage[];
  isStreaming: boolean;
  streamToolTrace: string;
  setInputHistory: Dispatch<SetStateAction<string[]>>;
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setStreamText: Dispatch<SetStateAction<string>>;
  setStreamToolTrace: Dispatch<SetStateAction<string>>;
  setMuthurStall: Dispatch<SetStateAction<MuthurResponseStall | null>>;
  setMuthurResponseFailed: Dispatch<SetStateAction<boolean>>;
  setMuthurDiagnostics: Dispatch<SetStateAction<MuthurDiagnosticsState>>;
  setGeneratedUI: Dispatch<SetStateAction<string | null>>;
  composeStartedAtRef: { current: number | null };

  // send intents
  isClearChatIntent: (userMessage: string) => boolean;
  handleClearChatIntent: () => void;
  tryHandleSurveyAndGlyphIntents: (userMessage: string) => Promise<boolean>;
  tryHandleHelpAndAtlasIntents: (userMessage: string) => Promise<boolean>;

  // refs
  messageInputRef: { current: MuthurCommandInputHandle | null };
  chatAbortRef: { current: AbortController | null };
  steerAbortRef: { current: boolean };
  steerPendingRef: { current: SteerPending };
  providerRateLimitUntilRef: { current: Record<string, number> };
  muthurMemoryRef: { current: MuthurMemoryState };
  operatorFolderRootsRef: { current: OperatorDocFolderRoot[] };

  // provider / model state
  activeProvider: string;
  providerKeys: Record<string, string>;
  modelID: string;
  hasProviderAuth: boolean;
  rateLimitedProviders: Set<string>;
  setProviderKeys: Dispatch<SetStateAction<Record<string, string>>>;
  setVerifiedProviders: Dispatch<SetStateAction<Record<string, boolean>>>;
  setModelFetchStatusByProvider: Dispatch<SetStateAction<Record<string, ModelFetchStatus>>>;
  setRateLimitedProviders: Dispatch<SetStateAction<Set<string>>>;
  setModelHealth: (provider: string, model: string, status: string) => void;
  fetchModelsForProvider: (provider: string, options?: { force?: boolean }) => Promise<void>;

  // MUTHUR posture / mission / inhabitant / memory
  muthurInhabitant: MuthurInhabitant;
  muthurPosture: MuthurPosture;
  muthurMission: MuthurMission | null;
  setMuthurMemory: Dispatch<SetStateAction<MuthurMemoryState>>;
  emitMuthurCognition: (input: MuthurCognitionEmitInput) => void;

  // pi control lease
  piControlLease: ReturnType<typeof usePiControlLease>;
  openOrFocusPiTab: () => void;

  // operator surface state
  operatorSurfaceMode: "workspace" | "browser";
  operatorSurfaceIsDocument: boolean;
  operatorBrowserSnapshot: string;
  operatorBrowserUrl: string;
  operatorDroppedAsset: DroppedOperatorAsset | null;
  operatorActiveFilePath: string | null;
  operatorDocMode: "view" | "edit";
  setOperatorSurfaceMode: Dispatch<SetStateAction<"workspace" | "browser">>;
  setOperatorDocMode: Dispatch<SetStateAction<"view" | "edit">>;
  setOperatorBrowserEngine: Dispatch<SetStateAction<string>>;
  openConvertedMarkdownInOperator: (
    filePath: string,
    options?: { edit?: boolean },
  ) => Promise<boolean>;
  openWorkspaceFileInOperator: (ref: MuthurOperatorOpenFileRef) => Promise<boolean>;
  saveOperatorDocInPlace: () => Promise<void>;
  applyGlyphActionsFromMuthur: (
    actions: ReturnType<typeof parseGlyphResponseActions>["actions"],
  ) => Promise<void>;

  // browser
  performBrowserCommand: (command: BrowserCommand) => Promise<string>;

  // tabs / navigation
  setNavRailContext: Dispatch<SetStateAction<"gateway" | "tabs">>;
  clearSavedCustomTabState: () => void;
  convertCustomTab: (
    tabId: string,
    nextKind: CustomTabKind,
    options?: { label?: string; glyph?: string },
  ) => void;
  deleteActiveTab: () => void;
  handleModelLabelClick: (targetServer?: "s" | "ct" | "b") => void;

  // chat scroll + audio
  pinMuthurChatToBottom: () => void;
  abortMotherSpeech: () => void;
};

export type UseMuthurChatSendResult = {
  handleSend: HandleSend;
  handleStop: () => void;
};

export function useMuthurChatSend(deps: UseMuthurChatSendOptions): UseMuthurChatSendResult {
  const {
    messages,
    isStreaming,
    streamToolTrace,
    setInputHistory,
    setMessages,
    setIsStreaming,
    setStreamText,
    setStreamToolTrace,
    setMuthurStall,
    setMuthurResponseFailed,
    setMuthurDiagnostics,
    setGeneratedUI,
    composeStartedAtRef,
    isClearChatIntent,
    handleClearChatIntent,
    tryHandleSurveyAndGlyphIntents,
    tryHandleHelpAndAtlasIntents,
    messageInputRef,
    chatAbortRef,
    steerAbortRef,
    steerPendingRef,
    providerRateLimitUntilRef,
    muthurMemoryRef,
    operatorFolderRootsRef,
    activeProvider,
    providerKeys,
    modelID,
    hasProviderAuth,
    rateLimitedProviders,
    setProviderKeys,
    setVerifiedProviders,
    setModelFetchStatusByProvider,
    setRateLimitedProviders,
    setModelHealth,
    fetchModelsForProvider,
    muthurInhabitant,
    muthurPosture,
    muthurMission,
    setMuthurMemory,
    emitMuthurCognition,
    piControlLease,
    openOrFocusPiTab,
    operatorSurfaceMode,
    operatorSurfaceIsDocument,
    operatorBrowserSnapshot,
    operatorBrowserUrl,
    operatorDroppedAsset,
    operatorActiveFilePath,
    operatorDocMode,
    setOperatorSurfaceMode,
    setOperatorDocMode,
    setOperatorBrowserEngine,
    openConvertedMarkdownInOperator,
    openWorkspaceFileInOperator,
    saveOperatorDocInPlace,
    applyGlyphActionsFromMuthur,
    performBrowserCommand,
    setNavRailContext,
    clearSavedCustomTabState,
    convertCustomTab,
    deleteActiveTab,
    handleModelLabelClick,
    pinMuthurChatToBottom,
    abortMotherSpeech,
  } = deps;

  // Stable self-reference so the steer-during-stream flow can re-enter the
  // latest handleSend closure without capturing a stale render.
  const handleSendRef = useRef<HandleSend>(async () => {});

  const handleSend: HandleSend = async (messageText, options, sendOptions) => {
    const userMessage = (messageText ?? messageInputRef.current?.getValue() ?? "").trim();
    if (!userMessage) return;

    if (isClearChatIntent(userMessage)) {
      handleClearChatIntent();
      return;
    }

    const tabCommand = parseCustomTabCommand(userMessage);
    if (!sendOptions?.skipAppendUser) {
      setInputHistory((prev) => [...prev, userMessage]);
      messageInputRef.current?.clear();
      pinMuthurChatToBottom();
      setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    }

    if (isStreaming) {
      steerPendingRef.current = { userMessage, options };
      steerAbortRef.current = true;
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
      } else {
        setIsStreaming(false);
        setStreamText("");
        setStreamToolTrace("");
        const pending = steerPendingRef.current;
        steerPendingRef.current = null;
        if (pending) {
          void handleSendRef.current(pending.userMessage, pending.options, { skipAppendUser: true });
        }
      }
      return;
    }

    if (muthurInhabitant !== "muthur") {
      setIsStreaming(true);
      composeStartedAtRef.current = Date.now();
      setStreamText("");
      setStreamToolTrace("");
      setMuthurStall(null);
      setMuthurResponseFailed(false);

      const abortCtl = new AbortController();
      chatAbortRef.current = abortCtl;

      try {
        const result = await sendMuthurInhabitantMessage({
          inhabitant: muthurInhabitant,
          userMessage,
          messages,
          signal: abortCtl.signal,
          onStream: setStreamText,
        });

        if (!result.ok) {
          setMessages((prev) => [
            ...prev,
            {
              role: "error",
              text: `${formatInhabitantChannelLabel(muthurInhabitant)} // FAILED // ${result.error}`,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: result.text,
              inhabitant: muthurInhabitant,
            },
          ]);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          const msg = err instanceof Error ? err.message : String(err);
          setMessages((prev) => [
            ...prev,
            {
              role: "error",
              text: `${formatInhabitantChannelLabel(muthurInhabitant)} // FAILED // ${msg.slice(0, 200)}`,
            },
          ]);
        }
      } finally {
        chatAbortRef.current = null;
        setStreamText("");
        setStreamToolTrace("");
        setIsStreaming(false);
        composeStartedAtRef.current = null;
        setMuthurStall(null);
      }
      return;
    }

    const providerCooldownUntil = providerRateLimitUntilRef.current[activeProvider] || 0;
    if (providerCooldownUntil && Date.now() < providerCooldownUntil) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `SEND_COOLDOWN // ${activeProvider.toUpperCase()} // WAIT_${Math.ceil((providerCooldownUntil - Date.now()) / 1000)}S`,
        },
      ]);
      return;
    }
    if (rateLimitedProviders.has(activeProvider)) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `SEND_BLOCKED // ${activeProvider.toUpperCase()} // RATE_LIMIT // OPERATOR_ACTION_REQUIRED`,
        },
      ]);
      return;
    }

    if (muthurPosture === "agent" && piControlLease.snapshot.activeLease) {
      try {
        await piControlLease.retake();
        setMuthurDiagnostics((current) =>
          appendMuthurDiagnosticEntry(current, "AUTHORITY RETURN // agent mode // pi lease cleared"),
        );
      } catch {
        /* best-effort — operator can use Retake Control banner */
      }
    }

    const computerUseMission = detectComputerUseMission(userMessage);
    if (
      computerUseMission &&
      muthurPosture === "commander" &&
      !piControlLease.snapshot.activeLease
    ) {
      try {
        const leaseState = await piControlLease.requestMission(userMessage, computerUseMission, {
          posture: muthurPosture,
        });
        if (!isPiControlLeaseUiGatingEnabled() && leaseState.activeLease) {
          openOrFocusPiTab();
          queuePiMission({
            missionText: computerUseMission.missionText,
            task: computerUseMission.task,
          });
          setMuthurDiagnostics((current) =>
            appendMuthurDiagnosticEntry(
              current,
              `CONTROL AUTO-GRANTED // ${computerUseMission.task} // operator: Pi`,
            ),
          );
        } else if (leaseState.pendingRequest) {
          setMuthurDiagnostics((current) =>
            appendMuthurDiagnosticEntry(
              current,
              `CONTROL REQUEST // ${computerUseMission.task} // operator: Pi // awaiting grant`,
            ),
          );
        }
      } catch {
        /* lease request best-effort */
      }
    }

    setIsStreaming(true);
    setStreamText(MUTHUR_UPLINK_PREPARING);
    setStreamToolTrace("");
    setMuthurResponseFailed(false);
    setMuthurStall(null);
    setGeneratedUI(null);

    if (await tryHandleSurveyAndGlyphIntents(userMessage)) {
      return;
    }

    if (tabCommand?.kind === "create") {
      const id = `tab-${crypto.randomUUID()}`;
      const tab: CustomTab = {
        id,
        label: tabCommand.label,
        glyph: tabCommand.glyph,
        kind: "blank",
      };
      useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(id);
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `TAB_CREATED // ${tab.label} // GLYPH ${tab.glyph}`,
        },
      ]);
      setIsStreaming(false);
      return;
    }

    if (tabCommand?.kind === "clear") {
      clearSavedCustomTabState();
      setIsStreaming(false);
      return;
    }

    if (tabCommand?.kind === "convert") {
      const activeCustomTabId = useCyberdeckTabStore.getState().activeCustomTabId;
      if (!activeCustomTabId) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "TAB_CONVERT_SKIPPED // SELECT_A_CUSTOM_TAB_FIRST" },
        ]);
        setIsStreaming(false);
        return;
      }

      const activeTab = useCyberdeckTabStore
        .getState()
        .customTabs.find((tab) => tab.id === activeCustomTabId);
      if (!isUnassignedCustomTab(activeTab)) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "TAB_CONVERT_SKIPPED // TAB_TYPE_LOCKED" },
        ]);
        setIsStreaming(false);
        return;
      }

      convertCustomTab(activeCustomTabId, tabCommand.surfaceKind, {
        label: tabCommand.label,
        glyph: tabCommand.glyph,
      });
      setIsStreaming(false);
      return;
    }

    if (/^(?:\/tab|tab:)?\s*(?:delete|remove|close)\s+tab(?:\s+(?:active|current|selected))?$/i.test(userMessage)) {
      const activeCustomTabId = useCyberdeckTabStore.getState().activeCustomTabId;
      if (activeCustomTabId) {
        deleteActiveTab();
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "TAB_REMOVED // ACTIVE_CUSTOM_TAB" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "TAB_REMOVE_SKIPPED // NO_ACTIVE_CUSTOM_TAB" },
        ]);
      }
      setIsStreaming(false);
      return;
    }

    const settingsCmd = userMessage.trim().toLowerCase();
    if (settingsCmd === "settings" || settingsCmd === "/settings") {
      handleModelLabelClick("b");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "SETTINGS_SURFACE // CONFIG_PLANE" },
      ]);
      setIsStreaming(false);
      return;
    }

    if (await tryHandleHelpAndAtlasIntents(userMessage)) {
      return;
    }

    const aionIntent = parseAionQuery(userMessage);
    if (aionIntent) {
      try {
        const res = await fetch("/api/muthur/aion-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Aion query failed (${res.status})`);
        }
        const payload = (await res.json()) as {
          handled?: boolean;
          response?: string;
        };
        if (payload.handled && payload.response) {
          setMessages((prev) => [...prev, { role: "assistant", text: payload.response! }]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: "AION_LINEAGE // UNHANDLED // intent not recognized by server",
            },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `AION_LINEAGE // ERROR // ${err instanceof Error ? err.message : "retrieval failed"}`,
          },
        ]);
      }
      setIsStreaming(false);
      return;
    }

    const foundationIntent = parseFoundationQuery(userMessage);
    if (foundationIntent) {
      try {
        const res = await fetch("/api/muthur/foundation-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Foundation query failed (${res.status})`);
        }
        const payload = (await res.json()) as {
          handled?: boolean;
          response?: string;
        };
        if (payload.handled && payload.response) {
          setMessages((prev) => [...prev, { role: "assistant", text: payload.response! }]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: "FOUNDATION_RETRIEVAL // UNHANDLED // intent not recognized by server",
            },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `FOUNDATION_RETRIEVAL // FAILED // ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ]);
      }
      setStreamText("");
      setStreamToolTrace("");
      setIsStreaming(false);
      composeStartedAtRef.current = null;
      setMuthurStall(null);
      return;
    }

    const documentOpenIntent = parseDocumentOpenIntent(userMessage);
    if (documentOpenIntent) {
      try {
        const res = await fetch("/api/muthur/document-open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Document open failed (${res.status})`);
        }
        const payload = (await res.json()) as {
          handled?: boolean;
          response?: string;
          operator_open?: { filePath: string; fileName: string; mode: "view" | "edit" };
          receipt?: { resolved_file?: string | null; tool_chain?: string[] };
        };
        if (payload.handled && payload.response) {
          if (payload.operator_open) {
            await openWorkspaceFileInOperator(payload.operator_open);
          }
          setMessages((prev) => [...prev, { role: "assistant", text: payload.response! }]);
          if (payload.receipt) {
            const receiptLine = `DOCUMENT_OPEN // resolved=${payload.receipt.resolved_file ?? "none"} // tools=${(payload.receipt.tool_chain ?? []).join(" → ")}`;
            setMuthurDiagnostics((current) => appendMuthurDiagnosticEntry(current, receiptLine));
          }
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: "DOCUMENT_OPEN // UNHANDLED // intent not recognized by server",
            },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `DOCUMENT_OPEN // FAILED // ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ]);
      }
      setStreamText("");
      setStreamToolTrace("");
      setIsStreaming(false);
      composeStartedAtRef.current = null;
      setMuthurStall(null);
      return;
    }

    const muthurReviewMatch = userMessage.match(/^\/muthur\s+review\s*$/i);
    if (muthurReviewMatch) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "⚡ MUTHUR_REVIEW // FETCHING_CHANGES..." },
      ]);
      setIsStreaming(true);
      setStreamText("⚡ MUTHUR is analyzing changes...");
      try {
        const res = await fetch("/api/git-diff");
        if (!res.ok) throw new Error("Failed to get diff");
        const { diff } = await res.json() as { diff: string };
        
        if (!diff) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `REVIEW OUTCOME: BLOCKED

SUMMARY: No changes detected in the repository.

SCOPE REVIEWED: None - no git diff available.

FINDINGS: None.

VALIDATION: Not applicable.

RISK LEVEL: N/A

DOCTRINE CHECK: Cannot verify - no changes present.

RECOMMENDED ACTION: Make code changes first before requesting review.

CONFIDENCE: 1.00` },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "system", text: "⚡ MUTHUR_REVIEW // DIFF_RETRIEVED // ANALYZING..." },
          ]);
          setStreamText("⚡ MUTHUR analyzing changes...\n\n" + diff.slice(0, 500) + (diff.length > 500 ? "\n... (diff truncated)" : ""));
          
          const reviewPrompt = `You are MUTHUR, the Echo Mirage operational AI. You must produce a STRUCTURED REVIEW of code changes.

IMPORTANT: You MUST follow the output format below. NEVER respond with just "Review complete." - you must provide a full structured report.

OUTPUT FORMAT:
\`\`\`
REVIEW OUTCOME: [PASS|REVISE|FAIL|BLOCKED]

SUMMARY:
[Brief explanation of what changed]

SCOPE REVIEWED:
[Files and artifacts reviewed]

FINDINGS:
1. [Finding description]
   Severity: [LOW|MEDIUM|HIGH|CRITICAL]
   Evidence: [file path, diff reference, or observed behavior]
   Recommendation: [fix or "none"]

VALIDATION:
- pnpm exec tsc --noEmit: [PASS|FAIL|NOT RUN]
- pnpm build: [PASS|FAIL|NOT RUN]
- Manual validation: [PASS|FAIL|NOT RUN]

RISK LEVEL: [LOW|MEDIUM|HIGH|CRITICAL]

DOCTRINE CHECK:
- explicit operational ownership: [PASS|FAIL|N/A]
- interruptibility: [PASS|FAIL|N/A]
- visible handoff: [PASS|FAIL|N/A]
- no hidden active systems: [PASS|FAIL|N/A]
- memory may recall, documents decide: [PASS|FAIL|N/A]
- human-supervised control transfer: [PASS|FAIL|N/A]

RECOMMENDED ACTION: [merge|revise before merge|block until fixed|run missing validation|request human decision]

CONFIDENCE: [0.00 to 1.00]
\`\`\`

RULES:
1. If no diff is available, output REVIEW OUTCOME: BLOCKED
2. If diff exists but no tests run, outcome should be REVISE (unless documentation-only)
3. If validation fails, outcome must be FAIL
4. If validation passes and no risks found, outcome may be PASS
5. NEVER say "Review complete." without the full structured report
6. If your response doesn't contain "REVIEW OUTCOME:", it will be rejected

Here are the code changes to review:
${diff}`;

          const reviewRes = await postCyberdeckChatUplink({
            message: reviewPrompt,
            provider: activeProvider,
            apiKey: providerKeys[activeProvider] || "",
            model: modelID,
            memoryContext: "",
            browserContext: "",
            history: [],
          });
          
          if (reviewRes.ok) {
            const reviewText = await readCyberdeckChatStream(reviewRes);
            if (reviewText !== null) {
              if (!reviewText.includes("REVIEW OUTCOME:")) {
                setMessages((prev) => [
                  ...prev,
                  { role: "system", text: "⚠️ MUTHUR_REVIEW // INVALID_FORMAT" },
                ]);
                setStreamText("");
              } else {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", text: "✅ " + reviewText },
                ]);
                setStreamText("");
              }
            } else {
              setMessages((prev) => [
                ...prev,
                { role: "system", text: "MUTHUR_REVIEW // FAILED // NO_STREAM" },
              ]);
              setStreamText("");
            }
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "system", text: "MUTHUR_REVIEW // FAILED // API_ERROR" },
            ]);
            setStreamText("");
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "MUTHUR_REVIEW // FAILED // ERROR" },
        ]);
        setStreamText("");
      } finally {
        setIsStreaming(false);
      }
      return;
    }

    if (/^(document|document mode|operator|operator pane|close browser|exit browser|workspace)$/i.test(userMessage.trim())) {
      setOperatorSurfaceMode("workspace");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "OPERATOR // DOCUMENT MODE — use the folder icon (top right) to browse files." },
      ]);
      setIsStreaming(false);
      return;
    }

    // Gateway key registration (weyland: set key + LS, model fetch effect validates)
    if (!hasProviderAuth) {
      handleModelLabelClick("s");
      setProviderKeys((prev) => ({ ...prev, [activeProvider]: userMessage }));
      try {
        localStorage.setItem(`key_${activeProvider}`, userMessage);
      } catch {
        /* ignore */
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `KEY FOR ${activeProvider.toUpperCase()} REGISTERED // VALIDATING_LINK // If this was a message to MUTHUR, wait for model list to load, select a model, then resend.`,
        },
      ]);
      void fetchModelsForProvider(activeProvider, { force: true });
      setIsStreaming(false);
      return;
    }

    if (!modelID) {
      handleModelLabelClick("s");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "NO_MODEL_SELECTED // WAIT_FOR_MODELS_OR_CHECK_KEY" },
      ]);
      setIsStreaming(false);
      return;
    }

    const directBrowserCommand = parseBrowserCommand(userMessage);
    if (directBrowserCommand) {
      setIsStreaming(true);
      composeStartedAtRef.current = Date.now();
      setStreamText("⏳ MUTHUR // operator browser (local)…\n");
      try {
        const actionResult = await performBrowserCommand(directBrowserCommand);
        const searchLabel =
          directBrowserCommand.kind === "goto" ? directBrowserCommand.url : directBrowserCommand.kind;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Opened operator web browser.\n\n${searchLabel}`,
            toolTrace: "operator_browser",
          },
          {
            role: "system",
            text: `BROWSER_ACTION // ${directBrowserCommand.kind.toUpperCase()} // ${actionResult}`,
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) => [
          ...prev,
          { role: "error", text: `BROWSER_ACTION // FAILED // ${msg.slice(0, 200)}` },
        ]);
      } finally {
        setStreamText("");
        setIsStreaming(false);
        composeStartedAtRef.current = null;
        setMuthurStall(null);
      }
      return;
    }

    let browserContextForRequest =
      operatorSurfaceMode === "browser" ? operatorBrowserSnapshot || `URL: ${operatorBrowserUrl}` : "";

    const operatorAssetSurface = operatorDroppedAsset
      ? resolveOperatorAssetSurface(operatorDroppedAsset)
      : null;
    const operatorLocalPath =
      operatorDroppedAsset?.localFilePath?.trim() || operatorActiveFilePath?.trim() || "";

    let messageForApi = userMessage;
    let autoConvertedDocx = false;
    if (
      isDocumentEditIntent(userMessage) &&
      operatorAssetSurface === "docx" &&
      operatorLocalPath &&
      operatorSurfaceMode === "workspace"
    ) {
      setStreamText("⏳ Converting DOCX to markdown for MUTHUR…");
      const converted = await openConvertedMarkdownInOperator(operatorLocalPath, { edit: true });
      if (converted) {
        autoConvertedDocx = true;
        flushMuthurObservation();
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        messageForApi = `${userMessage}\n\n[System: The open DOCX was converted to markdown in the operator pane. Use observe_operator_pane then suggest_operator_edit to apply the requested text change.]`;
      }
    }

    const operatorContext = {
      previewSurface: autoConvertedDocx ? "markdown" : operatorAssetSurface,
      fileName:
        operatorDroppedAsset?.name ??
        (operatorActiveFilePath?.trim() ? operatorActiveFilePath.split("/").pop() ?? null : null),
      localFilePath: operatorLocalPath || null,
      docMode: operatorDocMode,
    };

    if (isOperatorPaneEditRequest(userMessage, operatorContext) && operatorSurfaceIsDocument) {
      flushMuthurObservation();
    }

    if (messageReferencesLocalPath(messageForApi)) {
      messageForApi = `${messageForApi}\n\n[System: Local filesystem path referenced — use localfs ls/cat/stat on that path. Do not open the web browser.]`;
    }

    if (isMuthurSelfModifyIntent(messageForApi) && muthurPosture === "plan") {
      messageForApi = `${messageForApi}\n\n[System: Operator wants Echo Mirage / MUTHUR source edits. Plan posture is read-only — outline the change and remind them to switch to Agent (USE) to apply localfs write patches.]`;
    }

    const uplink = createUplinkTimeout();
    try {
      const abortCtl = uplink.controller;
      chatAbortRef.current = abortCtl;
      const memoryContext = buildMuthurMemoryContext(muthurMemoryRef.current, userMessage);
      emitMuthurCognition(cognitionFromUserMessage(userMessage));
      const memoryCognition = cognitionFromMemoryContext(memoryContext, userMessage);
      if (memoryCognition) {
        emitMuthurCognition(memoryCognition);
      }
      const history = buildCyberdeckChatHistory(messages);
      const glyphContext = await buildGlyphContextSnapshot();
      const piScreenContext = formatPiScreenContextForMuthur(readPiScreenSnapshot());
      const outboundCredentials = resolveOutboundProviderCredentials(activeProvider, providerKeys);
      let res: Response;
      try {
        res = await postCyberdeckChatUplink(
          {
            message: messageForApi,
            provider: activeProvider,
            apiKey: outboundCredentials.apiKey || undefined,
            credentialSource: outboundCredentials.credentialSource,
            model: modelID,
            memoryContext,
            browserContext: browserContextForRequest,
            glyphContext,
            piScreenContext,
            history,
            operatorContext,
            posture: muthurPosture,
            commanderMissionActive: canExecuteCommanderMissionWork(muthurMission),
          },
          abortCtl.signal,
        );
      } finally {
        uplink.clear();
      }

      if (!res.ok) {
        let rawDetail = "";
        let receiptReason = "";
        const receiptHeader = res.headers.get("x-muthur-provider-receipt");
        if (receiptHeader) {
          try {
            const receipt = JSON.parse(receiptHeader) as {
              provider: string;
              model?: string;
              credential_source: string;
              auth: string;
              reason?: string;
            };
            receiptReason = receipt.reason ?? "";
            setMuthurDiagnostics((current) =>
              appendMuthurDiagnosticEntry(current, formatProviderReceiptDiagnostic(receipt)),
            );
          } catch {
            /* ignore malformed receipt */
          }
        }
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const payload = (await res.json()) as {
              error?: string;
              message?: string;
              reason?: string;
              receipt?: { reason?: string };
            };
            rawDetail = String(payload?.error || payload?.message || "").trim();
            receiptReason = receiptReason || payload?.reason || payload?.receipt?.reason || "";
          } else {
            rawDetail = (await res.text()).trim();
          }
        } catch {
          /* ignore parse errors */
        }
        const detail = formatUplinkErrorDetail(res.status, rawDetail);
        const statusLine = `API error ${res.status}`;
        const reasonSuffix = receiptReason ? ` // ${receiptReason.toUpperCase()}` : "";
        throw new Error(detail ? `${statusLine}${reasonSuffix}: ${detail}` : `${statusLine}${reasonSuffix}`);
      }

      const providerReceiptHeader = res.headers.get("x-muthur-provider-receipt");
      if (providerReceiptHeader) {
        try {
          const receipt = JSON.parse(providerReceiptHeader) as {
            provider: string;
            model?: string;
            credential_source: string;
            auth: string;
            reason?: string;
          };
          setMuthurDiagnostics((current) =>
            appendMuthurDiagnosticEntry(current, formatProviderReceiptDiagnostic(receipt)),
          );
        } catch {
          /* ignore malformed receipt */
        }
      }

      const muthurToolsHeader = res.headers.get("x-muthur-tools-used")?.trim() ?? "";
      const operatorEdits = parseOperatorEditsHeader(res.headers.get("x-muthur-operator-edits"));
      const piControlHeader = res.headers.get("x-muthur-pi-control-request");
      if (piControlHeader && isPiControlLeaseUiGatingEnabled() && muthurPosture === "commander") {
        try {
          const pending = JSON.parse(piControlHeader) as PiControlLeaseRequest;
          piControlLease.applyPendingRequest(pending);
        } catch {
          /* ignore malformed lease header */
        }
      }
      setStreamToolTrace(muthurToolsHeader);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let streamDisplayText = "";
      let streamFlushRaf = 0;

      const flushStreamDisplay = () => {
        streamFlushRaf = 0;
        setStreamText(streamDisplayText);
      };

      const scheduleStreamFlush = () => {
        if (streamFlushRaf !== 0) return;
        streamFlushRaf = window.requestAnimationFrame(flushStreamDisplay);
      };

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          const pendingFromStream = parsePiControlLeaseStreamMarker(fullText);
          if (pendingFromStream && isPiControlLeaseUiGatingEnabled() && muthurPosture === "commander") {
            piControlLease.applyPendingRequest(pendingFromStream);
          }
          streamDisplayText = formatMuthurLiveStreamDisplay(fullText);
          scheduleStreamFlush();
        }
      }

      if (streamFlushRaf !== 0) {
        window.cancelAnimationFrame(streamFlushRaf);
        streamFlushRaf = 0;
      }
      setStreamText(streamDisplayText);

      // Clean up fullText - remove excessive === lines and trim
      const streamPayload = splitMuthurStreamPayload(fullText);
      if (streamPayload.toolsUsed) {
        setStreamToolTrace(streamPayload.toolsUsed);
      }
      const operatorEditsFromStream = streamPayload.operatorEdits;
      const glyphResponse = parseGlyphResponseActions(streamPayload.displayText);
      const toolsTrace =
        streamPayload.toolsUsed || muthurToolsHeader || streamToolTrace || "";
      let cleanedText = resolveMuthurCommittedDisplayText({
        fullText,
        streamDisplayText,
        glyphDisplayText: glyphResponse.displayText,
        toolsUsed: toolsTrace,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: cleanedText,
          ...(toolsTrace ? { toolTrace: toolsTrace } : {}),
        },
      ]);
      if (options?.surveyMission && cleanedText.trim()) {
        appendSurveyChatMessage({ role: "assistant", text: cleanedText });
      }
      setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, fullText));
      persistMuthurShipMemoryTurn(userMessage, cleanedText || fullText);

      if (toolsTrace) {
        setMuthurDiagnostics((current) =>
          appendMuthurDiagnosticBatch(current, [toolTraceToDiagnostic(toolsTrace).text]),
        );
      }

      const reasoningTrace = extractMuthurStreamReasoning(fullText).reasoning;
      if (reasoningTrace) {
        setMuthurDiagnostics((current) =>
          appendMuthurDiagnosticEntry(current, formatMuthurReasoningDiagnostic(reasoningTrace)),
        );
      }

      // L-UI-001 P0: MUTHUR channel commits before post-stream diagnostics / operator I/O.
      setStreamText("");
      setStreamToolTrace("");
      setIsStreaming(false);
      composeStartedAtRef.current = null;
      setMuthurStall(null);

      if (activeProvider && modelID) {
        setVerifiedProviders((prev) => ({ ...prev, [activeProvider]: true }));
        setModelHealth(activeProvider, modelID, "green");
        setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "ready" }));
        setRateLimitedProviders((prev) => {
          const next = new Set(prev);
          next.delete(activeProvider);
          return next;
        });
      }

      try {
        const jsonMatch = fullText.match(/^\{[\s\S]*\}$/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.type === "providers") {
            const providersList = parsed.data
              .map(
                (p: { id: string; name: string; description: string; status: string }) =>
                  `${p.name} (${p.status}) - ${p.description}`,
              )
              .join("\n");
            setGeneratedUI(`[PROVIDERS]\n\n${providersList}`);
            return;
          }
          if (parsed.type === "models") {
            const modelsList = parsed.data
              .map(
                (m: { id: string; name: string; provider: string; status: string }) =>
                  `${m.name} [${m.provider}] - ${m.status}`,
              )
              .join("\n");
            setGeneratedUI(`[AVAILABLE MODELS]\n\n${modelsList}`);
            return;
          }
          if (parsed.type === "status") {
            const { provider, model, connection, memory } = parsed.data;
            setGeneratedUI(
              `[CONNECTION STATUS]\n\nProvider: ${provider}\nModel: ${model}\nStatus: ${connection}\nMemory: ${memory}`,
            );
            return;
          }
        }
      } catch {
        /* not JSON */
      }

      if (fullText.includes("[UI]")) {
        const uiMatch = fullText.match(/\[UI\]([\s\S]*?)\[\/UI\]/);
        if (uiMatch) setGeneratedUI(uiMatch[1].trim());
      }

      void (async () => {
        const codingVerifyReceipt =
          streamPayload.codingVerify ?? parseCodingVerifyHeader(res.headers.get("x-muthur-coding-verify"));
        if (codingVerifyReceipt) {
          const systemLines = [formatCodingVerifySystemLine(codingVerifyReceipt)];
          if (codingVerifyReceipt.passed && muthurPosture === "agent") {
            systemLines.push(
              "RUNTIME PATROL // queued after coding verify (tsc + /cyberdeck in background)",
            );
          }
          setMessages((prev) => [
            ...prev,
            ...systemLines.map((text) => ({ role: "system" as const, text })),
          ]);
        }

        if (!autoConvertedDocx) {
          const operatorConversionRef =
            streamPayload.operatorConversion ??
            parseOperatorConversionJson(res.headers.get("x-muthur-operator-conversion"));
          const convertPath =
            operatorConversionRef?.sourcePath ||
            (streamPayload.toolsUsed.includes("convert_document_to_markdown") && operatorLocalPath
              ? operatorLocalPath
              : "");
          if (convertPath) {
            const converted = await openConvertedMarkdownInOperator(convertPath, { edit: true });
            if (converted) {
              flushMuthurObservation();
              await waitForOperatorDocumentReady(3000);
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  text: `OPERATOR CONVERT // Opened markdown from ${convertPath} in the operator pane.`,
                },
              ]);
            }
          }
        }

        const operatorOpenRef =
          streamPayload.operatorOpenFile ??
          parseOperatorOpenJson(res.headers.get("x-muthur-operator-open"));
        if (operatorOpenRef) {
          const opened = await openWorkspaceFileInOperator(operatorOpenRef);
          if (opened) {
            flushMuthurObservation();
            await waitForOperatorDocumentReady(3000);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: `OPERATOR OPEN // ${operatorOpenRef.fileName} // ${operatorOpenRef.filePath}`,
              },
            ]);
          }
        }

        const operatorBrowserRef =
          streamPayload.operatorBrowser ??
          parseOperatorBrowserJson(res.headers.get("x-muthur-operator-browser"));
        if (operatorBrowserRef) {
          const actionResult = await performBrowserCommand(operatorBrowserRef);
          const engineMatch = actionResult.match(/ENGINE:\s*([A-Z0-9_ -]+)/i);
          if (engineMatch?.[1]) {
            setOperatorBrowserEngine(engineMatch[1].trim().toUpperCase().replace(/\s+/g, "_"));
          }
          const captchaBlocked =
            looksLikeCaptchaBlock(actionResult) || actionResult.includes("CAPTCHA_BLOCKED");
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: captchaBlocked
                ? `BROWSER_BLOCKED // CAPTCHA // MANUAL_COMPLETION_REQUIRED\n${actionResult}`
                : `BROWSER_ACTION // ${operatorBrowserRef.kind.toUpperCase()} // ${actionResult}`,
            },
          ]);
        }

        const surveyAutoConnectRef =
          streamPayload.surveyAutoConnect ??
          parseSurveyAutoConnectJson(res.headers.get("x-muthur-survey-auto-connect"));
        if (surveyAutoConnectRef) {
          try {
            const connectLine = await executeSurveyHubConnectForMuthur(surveyAutoConnectRef.force);
            setMessages((prev) => [
              ...prev,
              { role: "system", text: connectLine },
            ]);
          } catch (err) {
            setMessages((prev) => [
              ...prev,
              { role: "system", text: surveyAutoConnectFailureMessage(err) },
            ]);
          }
        }

        const editsToApply =
          operatorEditsFromStream.length > 0 ? operatorEditsFromStream : operatorEdits;
        let operatorEditApplied = false;

        if (glyphResponse.actions.length > 0) {
          try {
            await applyGlyphActionsFromMuthur(glyphResponse.actions);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: "GLYPH // applied to ⟁ Glyph Channel (edit mode).",
              },
            ]);
          } catch (glyphError) {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: `GLYPH // FAILED // ${glyphError instanceof Error ? glyphError.message : "Glyph apply failed"}`,
              },
            ]);
          }
        }

        const operatorEditFileName =
          operatorActiveFilePath?.split("/").pop() ||
          operatorDroppedAsset?.name ||
          "document";
        if (editsToApply.length > 0) {
          setOperatorDocMode("edit");
          const editResult = await applyMuthurOperatorEdits(editsToApply);
          if (editResult === "applied") {
            operatorEditApplied = true;
            const systemLines = ["OPERATOR EDIT // MUTHUR applied — Ctrl+Z to undo in the operator pane."];
            if (shouldAutoCommitOperatorEdits(muthurPosture)) {
              if (
                canSaveOperatorDocumentInPlace(
                  operatorActiveFilePath,
                  operatorDroppedAsset?.localFilePath,
                  operatorFolderRootsRef.current,
                )
              ) {
                await saveOperatorDocInPlace();
                systemLines.push(`OPERATOR SAVE // ${operatorEditFileName} // Agent auto-commit`);
              } else {
                systemLines.push(
                  `UNSAVED // ${operatorEditFileName} // no writable path for Agent auto-save`,
                );
              }
            } else {
              systemLines.push(`UNSAVED // ${operatorEditFileName} — save when ready (Ctrl+S)`);
            }
            setMessages((prev) => [
              ...prev,
              ...systemLines.map((text) => ({ role: "system" as const, text })),
            ]);
            if (!cleanedText.trim()) {
              const summary = summarizeMuthurOperatorEdits(
                editsToApply,
                operatorEditFileName,
                userMessage,
              );
              setMessages((prev) => {
                const next = [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                  const row = next[i];
                  if (row.role === "assistant" && !row.text.trim()) {
                    next[i] = { ...row, text: summary };
                    break;
                  }
                }
                return next;
              });
            }
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: "OPERATOR EDIT // FAILED // MUTHUR could not apply the edit in the operator pane.",
              },
            ]);
          }
        }

        if (
          codingVerifyReceipt &&
          !operatorEditApplied &&
          operatorActiveFilePath?.trim()
        ) {
          const touchedPath = codingVerifyReceipt.touched_paths.find((touch) =>
            pathsReferToSameOperatorFile(touch, operatorActiveFilePath),
          );
          if (touchedPath) {
            const synced = await reloadOperatorDocumentFromWorkspacePath(touchedPath);
            if (synced) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  text: "OPERATOR SYNC // reloaded open file from disk after MUTHUR write.",
                },
              ]);
            }
          }
        }
      })();
    } catch (err) {
      const msg = String(err);
      setMuthurResponseFailed(true);
      if (msg.includes("AbortError")) {
        if (steerAbortRef.current) {
          steerAbortRef.current = false;
          setStreamText("");
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: uplink.didTimeOut()
              ? "UPLINK_TIMEOUT // PROVIDER_OR_NETWORK // OPERATOR_ACTION_REQUIRED"
              : "REQUEST_ABORTED // STREAM_HALTED",
          },
        ]);
        setStreamText("");
        return;
      }
      if (msg.includes("timed out")) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: "UPLINK_TIMEOUT // PROVIDER_OR_NETWORK // OPERATOR_ACTION_REQUIRED",
          },
        ]);
        setStreamText("");
        return;
      }
      if (msg.includes("API error")) {
        playDeckWrongDoorShut();
        const status = msg.match(/API error\s+(\d{3})/i)?.[1] || "UNKNOWN";
        const modelLabel = modelID || "UNSET_MODEL";
        const haltStatuses = new Set(["429", "502", "503"]);
        if (haltStatuses.has(status)) {
          if (status === "429") {
            providerRateLimitUntilRef.current[activeProvider] = Date.now() + PROVIDER_RATE_LIMIT_COOLDOWN_MS;
          } else {
            setRateLimitedProviders((prev) => new Set(prev).add(activeProvider));
          }
        }
        const hint =
          status === "401" || status === "403"
            ? "CHECK_API_KEY"
            : status === "429"
              ? "RATE_LIMIT // OPERATOR_ACTION_REQUIRED"
              : status === "500"
                ? "UPLINK_INTERNAL_ERROR // CHECK_DEV_TERMINAL // RETRY"
              : status === "502" || status === "503"
                ? "PROVIDER_UNAVAILABLE // OPERATOR_ACTION_REQUIRED"
                : "CHECK_PROVIDER_MODEL_OR_NETWORK";
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `API_FAILURE // ${activeProvider.toUpperCase()} / ${modelLabel} // HTTP_${status} // ${hint}`,
          },
        ]);
        setStreamText("");
        return;
      }
      setMessages((prev) => [...prev, { role: "error", text: msg.slice(0, 280) }]);
    } finally {
      chatAbortRef.current = null;
      setStreamToolTrace("");
      setIsStreaming(false);
      const pendingSteer = steerPendingRef.current;
      if (pendingSteer) {
        steerPendingRef.current = null;
        void handleSendRef.current(pendingSteer.userMessage, pendingSteer.options, { skipAppendUser: true });
      }
    }
  };

  handleSendRef.current = handleSend;

  const handleStop = useCallback(() => {
    steerPendingRef.current = null;
    steerAbortRef.current = false;
    abortMotherSpeech();
    void loadComputerUse().then((cu) => {
      cu.emergencyStop();
      cu.cancelTeachingWatchdog();
    });
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    setIsStreaming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abortMotherSpeech]);

  return { handleSend, handleStop };
}
