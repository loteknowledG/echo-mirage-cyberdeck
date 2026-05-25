"use client";

import { useCallback, useMemo, useState } from "react";
import { AiOutlineFilePdf } from "react-icons/ai";
import { BsFileEarmarkWord } from "react-icons/bs";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import { cn } from "@/lib/utils";

export type OperatorExportFormat = "docx" | "pdf";

type OperatorExportPickerProps = {
  disabled?: boolean;
  onExport: (format: OperatorExportFormat) => void | Promise<void>;
};

/** Y-axis rolodex — scroll to DOCX/PDF label, release to export. */
export function OperatorExportPicker({ disabled, onExport }: OperatorExportPickerProps) {
  const [format, setFormat] = useState<OperatorExportFormat>("docx");

  const items = useMemo(
    () => [
      {
        value: "docx",
        label: "Export to DOCX",
        slide: <BsFileEarmarkWord className="h-3.5 w-3.5" aria-hidden />,
      },
      {
        value: "pdf",
        label: "Export to PDF",
        slide: <AiOutlineFilePdf className="h-3.5 w-3.5" aria-hidden />,
      },
    ],
    [],
  );

  const handleUserSelect = useCallback(
    (value: string) => {
      if (disabled) return;
      if (value !== "docx" && value !== "pdf") return;
      const next = value as OperatorExportFormat;
      setFormat(next);
      void onExport(next);
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
        value={format}
        onChange={(next) => {
          if (next === "docx" || next === "pdf") setFormat(next);
        }}
        onUserSelect={handleUserSelect}
        ariaLabel="Export format"
        viewportClassName="h-7 w-7"
        showTextWhileScrolling
        showTooltipOnSnap
      />
    </div>
  );
}
