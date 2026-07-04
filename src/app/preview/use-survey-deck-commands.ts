"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { CYBERDECK_PANE_REGISTRY } from "@/features/cyberdeck/pane-registry";
import {
  POWERFIST_STACK_CHANNEL,
  POWERFIST_STACK_PUSH_EVENT,
  type PowerFistStackCommand,
} from "@/lib/cyberdeck/powerfist-events";
import type { connectPowerfistRemoteSocket } from "@/lib/cyberdeck/powerfist-remote-socket";
import {
  executeSurveyDeckCommand,
  resolveSurveyEchoDeckContext,
} from "@/lib/cyberdeck/survey-deck-command.client";
import type { SurveyDeckCommandId } from "@/lib/cyberdeck/survey-deck-data";
import type { PreviewDeckWithTarget } from "./preview-data";
import { CARD_PUSH_RECEIPT_DURATION_MS, cardChatMessage } from "./preview-matrix-play";

type RemoteSocketRef = RefObject<ReturnType<typeof connectPowerfistRemoteSocket> | null>;

type UseSurveyDeckCommandsOptions = {
  activeDecks: PreviewDeckWithTarget[];
  applyFocus: (deckIndex: number, cardIndex: number) => void;
  composerText: string;
  setComposerText: (text: string) => void;
  onDeckCommand?: (command: string) => Promise<{ ok: boolean; message: string }>;
  remoteSocketRef: RemoteSocketRef;
};

export function useSurveyDeckCommands({
  activeDecks,
  applyFocus,
  composerText,
  setComposerText,
  onDeckCommand,
  remoteSocketRef,
}: UseSurveyDeckCommandsOptions) {
  const [pushReceiptHtml, setPushReceiptHtml] = useState<string | null>(null);
  const pushReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pushReceiptTimerRef.current) clearTimeout(pushReceiptTimerRef.current);
    },
    [],
  );

  const showPushReceipt = useCallback((html: string) => {
    if (pushReceiptTimerRef.current) clearTimeout(pushReceiptTimerRef.current);
    setPushReceiptHtml(html);
    pushReceiptTimerRef.current = setTimeout(() => {
      setPushReceiptHtml(null);
      pushReceiptTimerRef.current = null;
    }, CARD_PUSH_RECEIPT_DURATION_MS);
  }, []);

  const handlePushCard = useCallback(
    async (deckIndex: number, cardIndex: number) => {
      applyFocus(deckIndex, cardIndex);
      const deck = activeDecks[deckIndex];
      const card = deck.cards[cardIndex];

      if (card.surveyCommand) {
        const result = onDeckCommand
          ? await onDeckCommand(card.surveyCommand)
          : await executeSurveyDeckCommand(
              card.surveyCommand as SurveyDeckCommandId,
              resolveSurveyEchoDeckContext(),
            );
        showPushReceipt(
          result.ok
            ? `<strong>${card.title}</strong> — ${result.message}`
            : `<strong>${card.title}</strong> failed — ${result.message}`,
        );
        return;
      }

      if (card.title === "Survey Capture") {
        const remote = remoteSocketRef.current;
        if (!remote) {
          setPushReceiptHtml("Survey Capture requires a paired PowerFist link to Mirage.");
          return;
        }
        const result = await remote.sendSurveyCaptureMission();
        showPushReceipt(
          result.ok
            ? `Survey mission <strong>${result.missionId?.slice(0, 8) ?? "—"}…</strong> — Echo captures, Mirage solves.`
            : `Survey mission failed: ${result.error ?? "unknown error"}`,
        );
        return;
      }

      const deckTargetLabel = CYBERDECK_PANE_REGISTRY[deck.targetPane].label;
      const composerSupplement = composerText.trim() || undefined;
      const chatMessage = cardChatMessage(deck.name, deckTargetLabel, card);
      const detail: PowerFistStackCommand = {
        kind: "powerfist-stack-push",
        actor: "operator",
        card: {
          deckName: deck.name,
          risk: card.risk,
          title: card.title,
          type: card.type,
        },
        commandId: crypto.randomUUID(),
        message: chatMessage,
        toolOverride: card.toolOverride,
        composerSupplement,
        preparedArtifact: card.preview,
        targetPane: deckTargetLabel,
      };
      if (composerSupplement && card.toolOverride?.composerArg) {
        setComposerText("");
      }

      let deliveredRemotely = false;
      const remote = remoteSocketRef.current;
      if (remote) {
        const result = await remote.sendStackPush(detail);
        deliveredRemotely = result.ok;
      }

      if (!deliveredRemotely) {
        const event = new CustomEvent<PowerFistStackCommand>(POWERFIST_STACK_PUSH_EVENT, {
          cancelable: true,
          detail,
        });
        window.dispatchEvent(event);
        if (!event.defaultPrevented && "BroadcastChannel" in window) {
          const channel = new BroadcastChannel(POWERFIST_STACK_CHANNEL);
          channel.postMessage(detail);
          channel.close();
        }
      }

      showPushReceipt(
        deliveredRemotely
          ? `Remote push <strong>${card.title}</strong> from <strong>${deck.name}</strong> to desktop Echo Mirage.`
          : `Pushed <strong>${card.title}</strong> from <strong>${deck.name}</strong> onto the Echo Mirage command stack against <strong>${deckTargetLabel}</strong>.`,
      );
    },
    [
      activeDecks,
      applyFocus,
      composerText,
      onDeckCommand,
      remoteSocketRef,
      setComposerText,
      showPushReceipt,
    ],
  );

  return { handlePushCard, pushReceiptHtml };
}
