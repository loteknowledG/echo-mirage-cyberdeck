import type { PreviewDeckWithTarget } from "@/app/preview/preview-data";

export const SURVEY_ECHO_COMMAND = {
  SCREENSHOT: "echo.screenshot",
  START_LISTENING: "echo.start-listening",
  STOP_LISTENING: "echo.stop-listening",
  SAVE_RECORDING: "echo.save-recording",
  COPY_SELECTED: "echo.copy-selected",
} as const;

export const SURVEY_MIRAGE_COMMAND = {
  NEXT_ITEM: "mirage.next-item",
  PREVIOUS_ITEM: "mirage.previous-item",
  ANSWER_ITEM: "mirage.answer-item",
  DISPLAY_ITEM: "mirage.display-item",
  SPEECH_TO_TEXT: "mirage.speech-to-text",
} as const;

export type SurveyDeckCommandId =
  | (typeof SURVEY_ECHO_COMMAND)[keyof typeof SURVEY_ECHO_COMMAND]
  | (typeof SURVEY_MIRAGE_COMMAND)[keyof typeof SURVEY_MIRAGE_COMMAND];

/** Echo + Mirage command decks — Survey PowerFist tab when triple-linked. */
export const SURVEY_TRIFORCE_DECKS: PreviewDeckWithTarget[] = [
  {
    name: "Echo Deck",
    badge: "echo satellite",
    targetPane: "operator",
    cards: [
      {
        type: "echo",
        title: "Take Screenshot",
        purpose: "Capture the Echo Mac primary display and stage it on Mirage.",
        risk: "safe",
        surveyCommand: SURVEY_ECHO_COMMAND.SCREENSHOT,
      },
      {
        type: "echo",
        title: "Start Listening",
        purpose: "Begin microphone capture on Echo Satellite for live transcription.",
        risk: "caution",
        surveyCommand: SURVEY_ECHO_COMMAND.START_LISTENING,
      },
      {
        type: "echo",
        title: "Stop Listening",
        purpose: "Stop the active Echo microphone session.",
        risk: "safe",
        surveyCommand: SURVEY_ECHO_COMMAND.STOP_LISTENING,
      },
      {
        type: "echo",
        title: "Save Recording",
        purpose: "Flush the buffered Echo audio recording to disk on the Echo Mac.",
        risk: "caution",
        surveyCommand: SURVEY_ECHO_COMMAND.SAVE_RECORDING,
      },
      {
        type: "echo",
        title: "Copy Selected",
        purpose: "Copy the frontmost selection on Echo — text, images, or PDF snippets.",
        risk: "safe",
        surveyCommand: SURVEY_ECHO_COMMAND.COPY_SELECTED,
      },
    ],
  },
  {
    name: "Mirage Deck",
    badge: "mirage hub",
    targetPane: "operator",
    cards: [
      {
        type: "mirage",
        title: "Next Item",
        purpose: "Advance to the next staged capture in the Mirage item queue.",
        risk: "safe",
        surveyCommand: SURVEY_MIRAGE_COMMAND.NEXT_ITEM,
      },
      {
        type: "mirage",
        title: "Previous Item",
        purpose: "Go back to the previous staged capture in the Mirage item queue.",
        risk: "safe",
        surveyCommand: SURVEY_MIRAGE_COMMAND.PREVIOUS_ITEM,
      },
      {
        type: "mirage",
        title: "Answer Item",
        purpose: "Send the current queue item to MUTHUR for an interview-ready answer.",
        risk: "caution",
        surveyCommand: SURVEY_MIRAGE_COMMAND.ANSWER_ITEM,
      },
      {
        type: "mirage",
        title: "Display Item",
        purpose: "Show the current queue item in the Mirage operator preview pane.",
        risk: "safe",
        surveyCommand: SURVEY_MIRAGE_COMMAND.DISPLAY_ITEM,
      },
      {
        type: "mirage",
        title: "Speech to Text",
        purpose: "Dictate into the current item using Mirage microphone (browser STT).",
        risk: "caution",
        surveyCommand: SURVEY_MIRAGE_COMMAND.SPEECH_TO_TEXT,
      },
    ],
  },
];
