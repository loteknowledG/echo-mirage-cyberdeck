"use client";

import { useEffect } from "react";
import {
  POWERFIST_STACK_CHANNEL,
  POWERFIST_STACK_PUSH_EVENT,
  type PowerFistStackCommand,
} from "@/lib/cyberdeck/powerfist-events";
import type { SurveyMissionSolveDetail } from "@/lib/cyberdeck/powerfist-mission.types";
import { connectPowerfistDeckSocket, fetchPowerfistDeckConnect } from "@/lib/cyberdeck/survey-hub-socket";
import { runPowerfistToolOverride } from "@/lib/cyberdeck/powerfist-tool-override";
import { formatCodingVerifySystemLine } from "@/features/cyberdeck/muthur/coding-verify-format";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { MuthurOperatorOpenFileRef } from "@/lib/muthur-core/types";
import {
  applyMuthurOperatorEdits,
  waitForOperatorDocumentReady,
} from "@/lib/operator-muthur-edit";
import { flushMuthurObservation } from "@/lib/muthur/observation/publish-observation";

export type UsePowerfistDeckSocketOptions = {
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  setOperatorDocMode: (mode: "view" | "edit") => void;
  handleSend: (
    message: string,
    options?: { preserveSelectedSurface?: boolean; surveyMission?: boolean },
  ) => void | Promise<void>;
  openWorkspaceFileInOperator: (ref: MuthurOperatorOpenFileRef) => Promise<boolean>;
  onMissionSolve: (detail: SurveyMissionSolveDetail) => void | Promise<void>;
};

/** PowerFist stack push (window event + BroadcastChannel) and Mirage deck WebSocket. */
export function usePowerfistDeckSocket({
  setMessages,
  setOperatorDocMode,
  handleSend,
  openWorkspaceFileInOperator,
  onMissionSolve,
}: UsePowerfistDeckSocketOptions): void {
  useEffect(() => {
    const pushToChat = async (detail: PowerFistStackCommand | undefined) => {
      if (!detail) return;

      const toolOverride = detail.toolOverride;
      if (toolOverride) {
        const cardLine = detail.message.trim() || `POWERFIST OVERRIDE // ${detail.card.title}`;
        setMessages((prev) => [...prev, { role: "user", text: cardLine }]);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `POWERFIST OVERRIDE // ${detail.card.title} // ${toolOverride.name}`,
          },
        ]);

        const result = await runPowerfistToolOverride(toolOverride, detail.composerSupplement);
        if (!result.ok) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: `TOOL FAILURE // ${result.error || result.text || toolOverride.name}`,
            },
          ]);
          return;
        }

        setMessages((prev) => [...prev, { role: "assistant", text: result.text.trim() }]);

        if (result.operatorOpenFile) {
          const opened = await openWorkspaceFileInOperator(result.operatorOpenFile);
          if (opened) {
            flushMuthurObservation();
            await waitForOperatorDocumentReady(3000);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: `OPERATOR OPEN // ${result.operatorOpenFile?.fileName} // ${result.operatorOpenFile?.filePath}`,
              },
            ]);
          }
        }

        if (result.operatorEdits && result.operatorEdits.length > 0) {
          setOperatorDocMode("edit");
          const editResult = await applyMuthurOperatorEdits(result.operatorEdits);
          if (editResult === "applied") {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: "OPERATOR EDIT // MUTHUR applied — Ctrl+Z to undo in the operator pane.",
              },
            ]);
          }
        }

        if (result.codingVerify) {
          setMessages((prev) => [
            ...prev,
            { role: "system", text: formatCodingVerifySystemLine(result.codingVerify!) },
          ]);
        }
        return;
      }

      const message = detail.message.trim();
      if (!message) return;
      void handleSend(message, { preserveSelectedSurface: true });
    };

    const handlePowerFistPush = (event: Event) => {
      event.preventDefault();
      void pushToChat((event as CustomEvent<PowerFistStackCommand>).detail);
    };

    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(POWERFIST_STACK_CHANNEL);
    if (channel) {
      channel.onmessage = (event: MessageEvent<PowerFistStackCommand>) => {
        void pushToChat(event.data);
      };
    }

    let deckSocket: ReturnType<typeof connectPowerfistDeckSocket> | null = null;
    let cancelled = false;
    void (async () => {
      const pairing = await fetchPowerfistDeckConnect();
      if (cancelled || !pairing.ok || !pairing.deckWsUrl) return;
      deckSocket = connectPowerfistDeckSocket({
        wsUrl: pairing.deckWsUrl,
        onStackPush: (command) => {
          void pushToChat(command);
        },
        onMissionSolve: onMissionSolve,
      });
    })();

    window.addEventListener(POWERFIST_STACK_PUSH_EVENT, handlePowerFistPush);
    return () => {
      cancelled = true;
      window.removeEventListener(POWERFIST_STACK_PUSH_EVENT, handlePowerFistPush);
      channel?.close();
      deckSocket?.close();
    };
  }, [handleSend, onMissionSolve, openWorkspaceFileInOperator, setMessages, setOperatorDocMode]);
}
