"use client";

import { useCallback, useMemo, useState } from "react";
import { AiOutlineFilePdf } from "react-icons/ai";
import { BsFileEarmarkWord } from "react-icons/bs";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import { cn } from "@/lib/utils";

export type OperatorExportFormat = "docx" | "pdf";

const EXPORT_FORMATS: OperatorExportFormat[] = ["docx", "pdf"];
const LOOP_COPIES = 5;
const LOOP_MIDDLE_COPY = Math.floor(LOOP_COPIES / 2);

function toPickerValue(format: OperatorExportFormat, copy = LOOP_MIDDLE_COPY): string {
  return `${format}:${copy}`;
}

function fromPickerValue(value: string): OperatorExportFormat | null {
  const [format] = value.split(":");
  return format === "docx" || format === "pdf" ? format : null;
}

type OperatorExportPickerProps = {
  disabled?: boolean;
  onExport: (format: OperatorExportFormat) => void | Promise<void>;
};

/** Y-axis rolodex — scroll to DOCX/PDF label, release to export. */
export function OperatorExportPicker({ disabled, onExport }: OperatorExportPickerProps) {
  const [value, setValue] = useState<string>(() => toPickerValue("docx"));

  const items = useMemo(
    () =>
      Array.from({ length: LOOP_COPIES }, (_, copyIndex) =>
        EXPORT_FORMATS.map((format) => ({
          value: toPickerValue(format, copyIndex),
          label: format === "docx" ? "Export to DOCX" : "Export to PDF",
          slide:
            format === "docx" ? (
              <BsFileEarmarkWord className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AiOutlineFilePdf className="h-3.5 w-3.5" aria-hidden />
            ),
        })),
      ).flat(),
    [],
  );

  const handleUserSelect = useCallback(
    (nextValue: string) => {
      if (disabled) return;
      const nextFormat = fromPickerValue(nextValue);
      if (!nextFormat) return;
      setValue(toPickerValue(nextFormat));
      void onExport(nextFormat);
    },
    [disabled, onExport],
  );

  return (
    <div
      className={cn("shrink-0", disabled && "pointer-events-none opacity-40")}
      aria-disabled={disabled || undefined}
    >
      <CyberdeckRollingPicker
        items={items}
        value={value}
        onChange={(next) => {
          const nextFormat = fromPickerValue(next);
          if (!nextFormat) return;
          setValue(toPickerValue(nextFormat));
        }}
        onUserSelect={handleUserSelect}
        ariaLabel="Export format"
        viewportClassName="h-7 w-7"
        showTextWhileScrolling
        loop
      />
    </div>
  );
}
