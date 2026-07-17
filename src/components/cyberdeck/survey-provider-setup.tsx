"use client";

import { useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  readSurveyGatewayCredentials,
  readSurveyGatewayModel,
  saveSurveyGatewayCredentials,
  saveSurveyGatewayModel,
  type SurveyGatewayProvider,
} from "@/lib/cyberdeck/survey-analyze.client";
import {
  defaultSurveyVisionModel,
  surveyVisionModelOptions,
} from "@/lib/cyberdeck/survey-vision-defaults";

const PROVIDER_LABELS: Record<SurveyGatewayProvider, string> = {
  opencode: "OPENCODE ZEN (text chat)",
  openrouter: "OPENROUTER (screenshots)",
  openai: "OPENAI (screenshots)",
};

/** Vision providers that support screenshot SOLVE (OpenCode is text-only here). */
const VISION_PROVIDERS: SurveyGatewayProvider[] = ["openrouter", "openai"];

export function SurveyProviderSetup() {
  const [provider, setProvider] = useState<SurveyGatewayProvider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [editing, setEditing] = useState(false);
  const [modelProvider, setModelProvider] =
    useState<SurveyGatewayProvider>("openrouter");
  const [model, setModel] = useState("");

  useEffect(() => {
    const saved = readSurveyGatewayCredentials();
    setConfigured(Boolean(saved));
    const activeVisionProvider = VISION_PROVIDERS.includes(
      saved?.gatewayProvider as SurveyGatewayProvider,
    )
      ? (saved?.gatewayProvider as SurveyGatewayProvider)
      : "openrouter";
    setModelProvider(activeVisionProvider);
    setModel(
      readSurveyGatewayModel(activeVisionProvider) ||
        defaultSurveyVisionModel(activeVisionProvider),
    );
  }, []);

  const save = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    saveSurveyGatewayCredentials(provider, trimmed);
    if (VISION_PROVIDERS.includes(provider)) {
      const nextModel =
        readSurveyGatewayModel(provider) || defaultSurveyVisionModel(provider);
      saveSurveyGatewayModel(provider, nextModel);
      setModelProvider(provider);
      setModel(nextModel);
    }
    setApiKey("");
    setConfigured(true);
    setEditing(false);
  };

  const changeModel = (forProvider: SurveyGatewayProvider, next: string) => {
    setModelProvider(forProvider);
    setModel(next);
    saveSurveyGatewayModel(forProvider, next);
  };

  const renderModelPicker = (forProvider: SurveyGatewayProvider) => {
    const options = surveyVisionModelOptions(forProvider);
    const current =
      forProvider === modelProvider && model
        ? model
        : readSurveyGatewayModel(forProvider) ||
          defaultSurveyVisionModel(forProvider);
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[8px] tracking-[0.1em] text-fuchsia-300/80">
          VISION MODEL
        </span>
        <select
          value={current}
          onChange={(event) => changeModel(forProvider, event.target.value)}
          className="h-7 min-w-48 flex-1 rounded border border-[#292929] bg-black px-2 text-[8px] text-[#c8c8c8] outline-none focus:border-fuchsia-700"
          aria-label="Survey vision model"
          data-testid="survey-vision-model"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
          {options.some((option) => option.id === current) ? null : (
            <option value={current}>{current} (custom)</option>
          )}
        </select>
      </div>
    );
  };

  if (configured && !editing) {
    return (
      <div className="mb-2 text-[8px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-emerald-300/80">ANALYZE // GATEWAY KEY READY</span>
          <button
            type="button"
            className="text-[#676767] underline decoration-[#333] underline-offset-2 hover:text-[#aaa]"
            onClick={() => setEditing(true)}
          >
            replace
          </button>
        </div>
        {renderModelPicker(modelProvider)}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded border border-amber-900/50 bg-amber-950/10 p-2">
      <p className="mb-2 text-[8px] leading-relaxed text-amber-200/80">
        SOLVE needs a vision model — OpenRouter or OpenAI keys read screenshots. OpenCode Zen is for
        text chat only on the hosted PWA.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as SurveyGatewayProvider)}
          className="h-7 rounded border border-[#292929] bg-black px-2 text-[8px] text-[#aaa] outline-none focus:border-fuchsia-700"
          aria-label="Survey analyze provider"
        >
          {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
          autoComplete="off"
          placeholder="API key"
          className="h-7 min-w-48 flex-1 rounded border border-[#292929] bg-black px-2 text-[9px] text-[#c8c8c8] outline-none placeholder:text-[#444] focus:border-fuchsia-700"
          aria-label="Survey analyze API key"
        />
        <CyberdeckActionButton
          variant="accent"
          disabled={!apiKey.trim()}
          onClick={save}
          data-testid="survey-provider-save"
        >
          SAVE KEY
        </CyberdeckActionButton>
        {configured ? (
          <CyberdeckActionButton variant="neutral" onClick={() => setEditing(false)}>
            CANCEL
          </CyberdeckActionButton>
        ) : null}
      </div>
      {VISION_PROVIDERS.includes(provider) ? renderModelPicker(provider) : null}
    </div>
  );
}
