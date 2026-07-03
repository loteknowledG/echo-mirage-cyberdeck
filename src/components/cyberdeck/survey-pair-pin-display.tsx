"use client";

import { useCallback, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { isValidSurveyPairPin } from "@/lib/cyberdeck/survey-pair-pin";

export async function copySurveyPairPin(pin: string): Promise<boolean> {
  const value = pin.trim();
  if (!value) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

type SurveyPairPinTone = "cyan" | "amber" | "fuchsia";

const PIN_TONE_CLASS: Record<SurveyPairPinTone, string> = {
  cyan: "text-cyan-200/90",
  amber: "text-amber-100",
  fuchsia: "text-fuchsia-200/90",
};

type SurveyPairPinCopyButtonProps = {
  pin: string;
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  className?: string;
};

export function SurveyPairPinCopyButton({
  pin,
  label = "Copy",
  copiedLabel = "Copied",
  failedLabel = "Copy failed",
  className,
}: SurveyPairPinCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copySurveyPairPin(pin);
    setFailed(!ok);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [pin]);

  const text = copied ? copiedLabel : failed ? failedLabel : label;

  return (
    <CyberdeckActionButton
      type="button"
      className={className}
      disabled={!pin.trim()}
      onClick={() => void handleCopy()}
      aria-label={`${label} pairing code ${pin}`}
    >
      {text}
    </CyberdeckActionButton>
  );
}

type SurveyPairPinDisplayProps = {
  pin: string;
  tone?: SurveyPairPinTone;
  copyLabel?: string;
};

/** Large 6-digit code with a copy action — Echo Satellite + Mirage hub. */
export function SurveyPairPinDisplay({
  pin,
  tone = "cyan",
  copyLabel = "Copy code",
}: SurveyPairPinDisplayProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className={`font-mono text-2xl tracking-[0.35em] ${PIN_TONE_CLASS[tone]}`}>{pin}</p>
      <SurveyPairPinCopyButton pin={pin} label={copyLabel} />
    </div>
  );
}

type SurveyPairPinCopyHintProps = {
  pin: string;
};

/** Compact copy row under OTP entry when all six digits are filled. */
export function SurveyPairPinCopyHint({ pin }: SurveyPairPinCopyHintProps) {
  if (!isValidSurveyPairPin(pin)) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] tracking-[0.06em] text-[#6a6a6a]">Ready to paste elsewhere?</span>
      <SurveyPairPinCopyButton pin={pin} label="Copy code" className="!px-2 !py-1 text-[9px]" />
    </div>
  );
}
