"use client";

import OtpInput from "react-otp-input";
import { SPY_PAIR_PIN_LENGTH } from "@/lib/cyberdeck/spy-pair-pin";

type SpyPairOtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  focusClassName?: string;
};

export function SpyPairOtpInput({
  value,
  onChange,
  disabled = false,
  focusClassName = "focus:border-cyan-900/60",
}: SpyPairOtpInputProps) {
  return (
    <OtpInput
      value={value}
      onChange={onChange}
      numInputs={SPY_PAIR_PIN_LENGTH}
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
