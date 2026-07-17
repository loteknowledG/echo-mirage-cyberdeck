/** Shared Survey vision defaults (client + server). */

/** OpenRouter VL default when openai/gpt-4o credits are exhausted. */
export const SURVEY_OPENROUTER_VISION_MODEL =
  "nvidia/nemotron-nano-12b-v2-vl:free";

export const SURVEY_OPENAI_VISION_MODEL = "gpt-4o-mini";

export function defaultSurveyVisionModel(
  provider: "openrouter" | "openai" | string,
): string {
  if (provider === "openrouter") return SURVEY_OPENROUTER_VISION_MODEL;
  if (provider === "openai") return SURVEY_OPENAI_VISION_MODEL;
  return SURVEY_OPENROUTER_VISION_MODEL;
}

export type SurveyVisionModelOption = {
  id: string;
  label: string;
};

/**
 * Curated free vision-capable OpenRouter models for SOLVE. Free tiers rotate
 * availability — if one is rate-limited, pick another. Slugs verified against
 * openrouter.ai model pages.
 */
export const SURVEY_OPENROUTER_VISION_MODELS: SurveyVisionModelOption[] = [
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", label: "Nemotron Nano 12B VL (free)" },
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (free)" },
  { id: "google/gemma-3-12b-it:free", label: "Gemma 3 12B (free)" },
  { id: "google/gemma-3-4b-it:free", label: "Gemma 3 4B (free)" },
  { id: "qwen/qwen2.5-vl-72b-instruct:free", label: "Qwen2.5 VL 72B (free)" },
  { id: "qwen/qwen2.5-vl-32b-instruct:free", label: "Qwen2.5 VL 32B (free)" },
  { id: "meta-llama/llama-3.2-11b-vision-instruct:free", label: "Llama 3.2 11B Vision (free)" },
  { id: "mistralai/mistral-small-3.1-24b-instruct:free", label: "Mistral Small 3.1 24B (free)" },
  { id: "moonshotai/kimi-vl-a3b-thinking:free", label: "Kimi VL A3B Thinking (free)" },
];

export const SURVEY_OPENAI_VISION_MODELS: SurveyVisionModelOption[] = [
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4o", label: "GPT-4o" },
];

export function surveyVisionModelOptions(
  provider: "openrouter" | "openai" | string,
): SurveyVisionModelOption[] {
  if (provider === "openai") return SURVEY_OPENAI_VISION_MODELS;
  return SURVEY_OPENROUTER_VISION_MODELS;
}
