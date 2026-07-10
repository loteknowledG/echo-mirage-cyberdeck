"use client";

import { useSurveyExtensionPageContextListener } from "@/lib/cyberdeck/survey-extension-page-context.client";

/** Listens for Echo Mirage Survey Satellite extension page captures. */
export function SurveyExtensionPageContextHost() {
  useSurveyExtensionPageContextListener();
  return null;
}
