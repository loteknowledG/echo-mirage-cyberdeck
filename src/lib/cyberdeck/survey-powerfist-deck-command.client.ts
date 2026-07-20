"use client";

import {
  SURVEY_POWERFIST_DECK_COMMAND,
  type SurveyPowerfistDeckCommandId,
} from "@/lib/cyberdeck/survey-deck-data";
import {
  resolveSurveyEchoDeckContext,
  takeSurveyScreenshot,
  type SurveyDeckCommandContext,
} from "@/lib/cyberdeck/survey-deck-command.client";
import { surveyCaptureDataUrl } from "@/lib/cyberdeck/survey-capture-mime";
import {
  clearSurveyScreenshotDisplay,
  solveMirageCaptureAsync,
  solveMirageSelectedTextAsync,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { captureEchoExtensionActiveTab } from "@/lib/cyberdeck/survey-echo-extension.client";
import {
  clearSurveyExtensionPageContext,
  solveLastSurveyExtensionPage,
} from "@/lib/cyberdeck/survey-extension-page-context.client";
import { executeSurveyDeckCommand } from "@/lib/cyberdeck/survey-deck-command.client";
import { SURVEY_ECHO_COMMAND } from "@/lib/cyberdeck/survey-deck-data";
import {
  clearSurveyListeningTranscript,
  solveSurveyListeningTranscript,
} from "@/lib/cyberdeck/survey-listening.client";
import { readSurveyListeningSource } from "@/lib/cyberdeck/survey-listening-source.client";
import {
  clearMirageLocalListeningTranscript,
  mirageLocalListeningDisplayText,
  startMirageLocalListening,
  stopMirageLocalListening,
} from "@/lib/cyberdeck/mirage-local-listening.client";

export type SurveyPowerfistDeckResult = {
  ok: boolean;
  message: string;
  imageDataUrl?: string;
  answerText?: string;
  keepArmed?: boolean;
};

/** Route a PowerFist Screenshot/Extension/Listening deck card to its Survey action. */
export async function executeSurveyPowerfistDeckCommand(
  command: SurveyPowerfistDeckCommandId,
  ctx: SurveyDeckCommandContext,
): Promise<SurveyPowerfistDeckResult> {
  switch (command) {
    case SURVEY_POWERFIST_DECK_COMMAND.ECHO_SCREENSHOT: {
      const result = await takeSurveyScreenshot(ctx);
      return {
        ok: result.ok,
        message: result.message,
        imageDataUrl: result.pngBase64
          ? surveyCaptureDataUrl(result.pngBase64)
          : undefined,
      };
    }
    case SURVEY_POWERFIST_DECK_COMMAND.SOLVE_CAPTURE: {
      const result = await solveMirageCaptureAsync();
      return { ok: result.ok, message: result.message, answerText: result.answerText };
    }
    case SURVEY_POWERFIST_DECK_COMMAND.CLEAR_CAPTURE:
      return clearSurveyScreenshotDisplay();
    case SURVEY_POWERFIST_DECK_COMMAND.EXT_CAPTURE_ACTIVE_TAB: {
      const result = await captureEchoExtensionActiveTab(ctx);
      return { ok: result.ok, message: result.message };
    }
    case SURVEY_POWERFIST_DECK_COMMAND.EXT_SOLVE:
      return solveLastSurveyExtensionPage();
    case SURVEY_POWERFIST_DECK_COMMAND.EXT_CLEAR:
      return clearSurveyExtensionPageContext();
    case SURVEY_POWERFIST_DECK_COMMAND.LISTEN: {
      if (readSurveyListeningSource() === "mirage") {
        // Stop Echo post if it was running so we don't mix sources.
        void executeSurveyDeckCommand(SURVEY_ECHO_COMMAND.STOP_LISTENING, ctx).catch(() => undefined);
        const result = await startMirageLocalListening();
        return {
          ok: result.ok,
          message: result.message,
          keepArmed: result.ok,
        };
      }
      stopMirageLocalListening();
      const result = await executeSurveyDeckCommand(SURVEY_ECHO_COMMAND.START_LISTENING, ctx);
      return {
        ok: result.ok,
        message: result.message,
        keepArmed: result.ok,
      };
    }
    case SURVEY_POWERFIST_DECK_COMMAND.SOLVE_LISTENING: {
      if (readSurveyListeningSource() === "mirage") {
        const text = mirageLocalListeningDisplayText();
        if (!text) {
          return { ok: false, message: "No Mirage transcript to solve yet." };
        }
        const result = await solveMirageSelectedTextAsync(text);
        return { ok: result.ok, message: result.message, answerText: result.answerText };
      }
      const result = await solveSurveyListeningTranscript();
      return { ok: result.ok, message: result.message, answerText: result.answerText };
    }
    case SURVEY_POWERFIST_DECK_COMMAND.CLEAR_LISTENING: {
      if (readSurveyListeningSource() === "mirage") {
        return clearMirageLocalListeningTranscript();
      }
      return clearSurveyListeningTranscript();
    }
    default: {
      const _exhaustive: never = command;
      return { ok: false, message: `Unknown deck command: ${String(_exhaustive)}` };
    }
  }
}

export { resolveSurveyEchoDeckContext };
