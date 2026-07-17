"use client";

import dynamic from "next/dynamic";
import type { Dispatch, SetStateAction } from "react";
import { CardTablePane } from "@/components/cyberdeck/card-table-pane";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import {
  attemptExecute,
  clearDeck,
  getCardTableState,
  prepareHandFromRegistry,
  pushHandToStack,
  syncStagedHandFromSelectedIds,
} from "@/lib/computer-use/card-table";
import { EXECUTION_CARD_REGISTRY, EXECUTION_HANDS, getHandCards } from "@/lib/computer-use/execution-card-registry";
import { narrate } from "@/lib/computer-use/narration";
import { isObserving, recordEvent } from "@/lib/computer-use/workflow-observation";

type CardTablePaneHostProps = {
  selectedCardIds: string[];
  setSelectedCardIds: Dispatch<SetStateAction<string[]>>;
};

/** Card table + computer-use — only reachable when ENABLE_CARD_TABLE mounts this host. */
export function CardTablePaneHost({ selectedCardIds, setSelectedCardIds }: CardTablePaneHostProps) {
  return (
    <CardTablePane
      activeHand={getCardTableState().activeHand}
      stagedCardCount={selectedCardIds.length}
      stackDepth={getCardTableState().executionStack.length}
      executionEnabled={getCardTableState().executionEnabled}
      topStackCard={
        getCardTableState().currentCard
          ? {
              title: getCardTableState().currentCard!.title,
              status: getCardTableState().currentCard!.status,
            }
          : null
      }
      stackCards={getCardTableState().executionStack.map((c) => ({
        title: c.title,
        status: c.status,
      }))}
      stagedCards={selectedCardIds.map((id) => {
        const card = getCardTableState().stagedHand?.cards.find((c) => c.id === id);
        return card
          ? {
              title: card.title,
              purpose: card.purpose,
              status: card.status,
              requiredConfirmation: card.requiredConfirmation,
            }
          : {
              title: id,
              purpose: "",
              status: "staged" as const,
              requiredConfirmation: false,
            };
      })}
      onPushHandToStack={() => {
        const result = pushHandToStack();
        if (result.pushed > 0 && isObserving()) {
          recordEvent("hand_pushed_to_stack", "Hand Pushed", `${result.pushed} cards pushed to stack`);
        }
        narrate("HAND_PUSHED_TO_STACK");
        setSelectedCardIds([]);
      }}
      onClearDeck={() => {
        clearDeck();
        if (isObserving()) recordEvent("stack_cleared", "Card Table", "Deck cleared via pane control");
        narrate("CARD_TABLE_CLEARED");
        setSelectedCardIds([]);
        useCyberdeckTabStore.getState().setServer("s");
      }}
      onExecute={() => {
        const result = attemptExecute();
        if (!result.success && isObserving()) {
          recordEvent("execution_attempt_blocked", "Execute Blocked", result.reason);
        }
        narrate("EXECUTION_DISABLED");
      }}
      onClose={() => useCyberdeckTabStore.getState().setServer("s")}
      onSelectHand={(handId) => {
        const hand = EXECUTION_HANDS.find((h) => h.id === handId);
        if (hand) {
          const cards = getHandCards(handId);
          prepareHandFromRegistry(hand.name, cards);
          setSelectedCardIds(cards.map((c) => c.id));
        }
      }}
      onStageCard={(cardId) => {
        const newSelected = selectedCardIds.includes(cardId)
          ? selectedCardIds.filter((id) => id !== cardId)
          : [...selectedCardIds, cardId];
        setSelectedCardIds(newSelected);
        syncStagedHandFromSelectedIds(newSelected, EXECUTION_CARD_REGISTRY);
      }}
      selectedCardIds={selectedCardIds}
    />
  );
}

export const LazyCardTablePaneHost = dynamic(
  () => Promise.resolve({ default: CardTablePaneHost }),
  { ssr: false, loading: () => <PanelLoader label="CARD TABLE" /> },
);
