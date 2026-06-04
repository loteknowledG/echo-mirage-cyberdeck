"use client";

import { useCallback, useState } from "react";
import { AiOutlineFilePdf } from "react-icons/ai";
import { BsFileEarmarkWord } from "react-icons/bs";
import { LuShare } from "react-icons/lu";
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

export type OperatorExportFormat = "docx" | "pdf";

const EXPORT_MENU_PANEL_CLASS =
  "min-w-[9.5rem] rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]";

type OperatorExportPickerProps = {
  disabled?: boolean;
  onExport: (format: OperatorExportFormat) => void | Promise<void>;
};

/** Toolbar export control — icon opens a pop-in menu for DOCX / PDF. */
export function OperatorExportPicker({ disabled = false, onExport }: OperatorExportPickerProps) {
  const deckMode = useDeckMode();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const runExport = useCallback(
    async (format: OperatorExportFormat) => {
      if (disabled || busy) return;
      setOpen(false);
      setBusy(true);
      try {
        await onExport(format);
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, onExport],
  );

  return (
    <DropdownMenu
      open={disabled ? false : open}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next);
      }}
    >
      <CyberdeckControlTooltip label="Export" disabled={disabled}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label="Export"
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
            <LuShare className="h-3.5 w-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
      </CyberdeckControlTooltip>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn(
          EXPORT_MENU_PANEL_CLASS,
          "rounded-sm border-2 border-[#2d2d2d] bg-black p-1 text-emerald-100 shadow-none",
        )}
      >
        <div
          className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#8a8a8a]"
          role="presentation"
        >
          Export
        </div>
        <div className="mx-0 my-1 h-px bg-[#2d2d2d]" role="separator" />
        <DropdownMenuItem
          disabled={busy}
          className={cn(
            realmorphismMenuItemClass(deckMode),
            "cursor-pointer rounded-sm focus:bg-[#141414] focus:text-emerald-200 data-[disabled]:opacity-40",
          )}
          onSelect={(event) => {
            event.preventDefault();
            void runExport("docx");
          }}
        >
          <BsFileEarmarkWord className="h-3.5 w-3.5 shrink-0" aria-hidden />
          DOCX
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy}
          className={cn(
            realmorphismMenuItemClass(deckMode),
            "cursor-pointer rounded-sm focus:bg-[#141414] focus:text-emerald-200 data-[disabled]:opacity-40",
          )}
          onSelect={(event) => {
            event.preventDefault();
            void runExport("pdf");
          }}
        >
          <AiOutlineFilePdf className="h-3.5 w-3.5 shrink-0" aria-hidden />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
