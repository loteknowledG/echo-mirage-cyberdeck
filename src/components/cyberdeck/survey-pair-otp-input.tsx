"use client";

import OtpInput from "react-otp-input";
import { SURVEY_PAIR_PIN_LENGTH } from "@/lib/cyberdeck/survey-pair-pin";

type SurveyPairOtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  focusClassName?: string;
};

export function SurveyPairOtpInput({
  value,
  onChange,
  disabled = false,
  focusClassName = "focus:border-cyan-900/60",
}: SurveyPairOtpInputProps) {
  return (
    <OtpInput
      value={value}
      onChange={onChange}
      numInputs={SURVEY_PAIR_PIN_LENGTH}
      inputType="tel"
      shouldAutoFocus
      renderInput={(props) => (
        <input
          {...props}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`h-10 w-9 border border-[#2d2d2d] bg-black text-center font-mono text-sm tracking-[0.12em] text-[#cfcfcf] outline-none disabled:opacity-50 ${focusClassName}`}
        />
      )}
      containerStyle="flex gap-2"
    />
  );
}
