"use client";

import { useSurveyExtensionPageContextListener } from "@/lib/cyberdeck/survey-extension-page-context.client";
import { SurveyExtensionReceiptToast } from "@/components/cyberdeck/survey-extension-receipt-toast";

/** Listens for Echo Mirage Survey Satellite extension page captures. */
export function SurveyExtensionPageContextHost() {
  useSurveyExtensionPageContextListener();
  return <SurveyExtensionReceiptToast />;
}
