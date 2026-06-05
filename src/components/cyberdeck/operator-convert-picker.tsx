"use client";

import { useCallback, useState } from "react";
import { AiOutlineFileMarkdown, AiOutlineFilePdf } from "react-icons/ai";
import { BsFileEarmarkWord } from "react-icons/bs";
import { LuRefreshCw } from "react-icons/lu";
import { CyberdeckControlTooltip } from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeckMode } from "@/lib/deck-mode";
import {
  LEGACY_TOOLBAR_ICON,
  realmorphismControlClass,
  realmorphismMenuItemClass,
} from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

export type OperatorConvertFormat = "markdown" | "docx" | "pdf";

export type OperatorConvertOption = {
  format: OperatorConvertFormat;
  disabled?: boolean;
  disabledReason?: string;
};

const CONVERT_MENU_PANEL_CLASS =
  "min-w-[10rem] rounded-sm border-2 border-[#2d2d2d] bg-black p-1 text-emerald-100 shadow-none";

const FORMAT_LABEL: Record<OperatorConvertFormat, string> = {
  markdown: "MARKDOWN",
  docx: "DOCX",
  pdf: "PDF",
};

const FORMAT_ICON: Record<OperatorConvertFormat, typeof AiOutlineFileMarkdown> = {
  markdown: AiOutlineFileMarkdown,
  docx: BsFileEarmarkWord,
  pdf: AiOutlineFilePdf,
};

type OperatorConvertPickerProps = {
  disabled?: boolean;
  options: OperatorConvertOption[];
  onConvert: (format: OperatorConvertFormat) => void | Promise<void>;
};

export function OperatorConvertPicker({
  disabled = false,
  options,
  onConvert,
}: OperatorConvertPickerProps) {
  const deckMode = useDeckMode();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const runConvert = useCallback(
    async (format: OperatorConvertFormat) => {
      if (disabled || busy) return;
      setOpen(false);
      setBusy(true);
      try {
        await onConvert(format);
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, onConvert],
  );

  return (
    <DropdownMenu
      open={disabled ? false : open}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next);
      }}
    >
      <CyberdeckControlTooltip label="Convert" disabled={disabled}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label="Convert"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              realmorphismControlClass(deckMode, {
                size: "toolbar",
                legacyClassName: LEGACY_TOOLBAR_ICON,
              }),
              "disabled:cursor-not-allowed disabled:opacity-30",
              open && !disabled && "is-signal",
            )}
          >
            <LuRefreshCw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
      </CyberdeckControlTooltip>
      <DropdownMenuContent align="end" sideOffset={6} className={CONVERT_MENU_PANEL_CLASS}>
        <div
          className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#8a8a8a]"
          role="presentation"
        >
          Convert
        </div>
        <div className="mx-0 my-1 h-px bg-[#2d2d2d]" role="separator" />
        {options.map((option) => {
          const Icon = FORMAT_ICON[option.format];
          const optionDisabled = busy || Boolean(option.disabled);
          return (
            <DropdownMenuItem
              key={option.format}
              disabled={optionDisabled}
              title={option.disabledReason}
              className={cn(
                realmorphismMenuItemClass(deckMode),
                "cursor-pointer rounded-sm focus:bg-[#141414] focus:text-emerald-200 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40",
              )}
              onSelect={(event) => {
                event.preventDefault();
                if (!optionDisabled) void runConvert(option.format);
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {FORMAT_LABEL[option.format]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
