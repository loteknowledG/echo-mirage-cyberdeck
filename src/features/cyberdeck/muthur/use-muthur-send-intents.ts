"use client";

import { useCallback, useMemo } from "react";
import type { GlyphCommand } from "@/lib/muthur-glyph-intent";
import {
  classifyHelpAtlasSendIntent,
  classifySurveyGlyphSendIntent,
  dispatchHelpAtlasSendIntent,
  executeGlyphSendIntent,
  executeMuthurClearChat,
  isMuthurClearChatIntent,
  tryExecuteSurveyConnectIntent,
  type MuthurClearChatDeps,
  type MuthurSendIntentMessageOps,
} from "@/features/cyberdeck/muthur/muthur-send-intents";

export type UseMuthurSendIntentsOptions = MuthurClearChatDeps & {
  handleGlyphOperatorCommand: (command: GlyphCommand) => Promise<void>;
};

export function useMuthurSendIntents(options: UseMuthurSendIntentsOptions) {
  const {
    handleGlyphOperatorCommand,
    abortMotherSpeech,
    chatAbortRef,
    steerPendingRef,
    steerAbortRef,
    setMuthurResponseFailed,
    setChatKeyboardHighlightIndex,
    setGeneratedUI,
    screenshotRef,
    messageInputRef,
    setMessages,
    setMuthurDiagnostics,
    setIsStreaming,
    setStreamText,
    setStreamToolTrace,
    setMuthurStall,
    composeStartedAtRef,
  } = options;

  const messageOps = useMemo<MuthurSendIntentMessageOps>(
    () => ({
      setMessages,
      setMuthurDiagnostics,
      setIsStreaming,
      setStreamText,
      setStreamToolTrace,
      setMuthurStall,
      composeStartedAtRef,
    }),
    [
      composeStartedAtRef,
      setIsStreaming,
      setMessages,
      setMuthurDiagnostics,
      setMuthurStall,
      setStreamText,
      setStreamToolTrace,
    ],
  );

  const handleClearChatIntent = useCallback(() => {
    executeMuthurClearChat({
      ...messageOps,
      abortMotherSpeech,
      chatAbortRef,
      steerPendingRef,
      steerAbortRef,
      setMuthurResponseFailed,
      setChatKeyboardHighlightIndex,
      setGeneratedUI,
      screenshotRef,
      messageInputRef,
    });
  }, [
    abortMotherSpeech,
    chatAbortRef,
    messageInputRef,
    messageOps,
    screenshotRef,
    setChatKeyboardHighlightIndex,
    setGeneratedUI,
    setMuthurResponseFailed,
    steerAbortRef,
    steerPendingRef,
  ]);

  const tryHandleSurveyAndGlyphIntents = useCallback(
    async (userMessage: string): Promise<boolean> => {
      if (await tryExecuteSurveyConnectIntent(userMessage, messageOps)) {
        return true;
      }

      const glyphCommand = classifySurveyGlyphSendIntent(userMessage);
      if (glyphCommand) {
        await executeGlyphSendIntent(glyphCommand, messageOps, handleGlyphOperatorCommand);
        return true;
      }

      return false;
    },
    [handleGlyphOperatorCommand, messageOps],
  );

  const tryHandleHelpAndAtlasIntents = useCallback(
    async (userMessage: string): Promise<boolean> => {
      const intent = classifyHelpAtlasSendIntent(userMessage);
      if (!intent) {
        return false;
      }

      await dispatchHelpAtlasSendIntent(intent, userMessage, messageOps);
      return true;
    },
    [messageOps],
  );

  return {
    isClearChatIntent: isMuthurClearChatIntent,
    handleClearChatIntent,
    tryHandleSurveyAndGlyphIntents,
    tryHandleHelpAndAtlasIntents,
  };
}
