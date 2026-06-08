"use client";

import { useCallback, useState } from "react";
import { AiOutlineFilePdf } from "react-icons/ai";
import { BsFileEarmarkWord } from "react-icons/bs";
import { LuShare } from "react-icons/lu";
import { CyberdeckControlTooltip } from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  CyberdeckMenuButton,
  CyberdeckPaneToolbarControl,
} from "@/components/cyberdeck/cyberdeck-control-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          <CyberdeckPaneToolbarControl
            control={{ size: "toolbar", signal: open && !disabled }}
            aria-label="Export"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled}
            className="disabled:cursor-not-allowed disabled:opacity-30"
          >
            <LuShare className="h-3.5 w-3.5" aria-hidden />
          </CyberdeckPaneToolbarControl>
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
          asChild
          disabled={busy}
          onSelect={(event) => {
            event.preventDefault();
            void runExport("docx");
          }}
        >
          <CyberdeckMenuButton
            role="menuitem"
            danger={false}
            className="cursor-pointer rounded-sm focus:bg-[#141414] focus:text-emerald-200 data-[disabled]:opacity-40"
          >
            <BsFileEarmarkWord className="h-3.5 w-3.5 shrink-0" aria-hidden />
            DOCX
          </CyberdeckMenuButton>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          disabled={busy}
          onSelect={(event) => {
            event.preventDefault();
            void runExport("pdf");
          }}
        >
          <CyberdeckMenuButton
            role="menuitem"
            danger={false}
            className="cursor-pointer rounded-sm focus:bg-[#141414] focus:text-emerald-200 data-[disabled]:opacity-40"
          >
            <AiOutlineFilePdf className="h-3.5 w-3.5 shrink-0" aria-hidden />
            PDF
          </CyberdeckMenuButton>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
