"use client";

import { useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  readSurveyGatewayCredentials,
  saveSurveyGatewayCredentials,
  type SurveyGatewayProvider,
} from "@/lib/cyberdeck/survey-analyze.client";

const PROVIDER_LABELS: Record<SurveyGatewayProvider, string> = {
  opencode: "OPENCODE ZEN (text chat)",
  openrouter: "OPENROUTER (screenshots)",
  openai: "OPENAI (screenshots)",
};

export function SurveyProviderSetup() {
  const [provider, setProvider] = useState<SurveyGatewayProvider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = readSurveyGatewayCredentials();
    setConfigured(Boolean(saved));
  }, []);

  const save = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    saveSurveyGatewayCredentials(provider, trimmed);
    setApiKey("");
    setConfigured(true);
    setEditing(false);
  };

  if (configured && !editing) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[8px]">
        <span className="text-emerald-300/80">ANALYZE // GATEWAY KEY READY</span>
        <button
          type="button"
          className="text-[#676767] underline decoration-[#333] underline-offset-2 hover:text-[#aaa]"
          onClick={() => setEditing(true)}
        >
          replace
        </button>
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
    </div>
  );
}
