"use client";

import { useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { CyberdeckControl } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  OPERATOR_DOC_TYPE_ENTRIES,
  normalizeOperatorDocumentKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import { operatorDocumentKindIcon, operatorIconSrc } from "@/lib/operator-file-icon";
import { cn } from "@/lib/utils";

const DOC_TYPE_MENU_MIN_WIDTH = "8.75rem";

const DOC_TYPE_MENU_PANEL_CLASS =
  "max-h-[min(70vh,320px)] overflow-y-auto rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]";

const DOC_TYPE_MENU_ITEM_CLASS =
  "flex w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1 font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] focus:bg-[#141414] focus:text-emerald-200";

type OperatorDocTypeMenuProps = {
  value: OperatorDocumentPickerKind;
  onChange: (kind: OperatorDocumentPickerKind) => void;
  /** Status strip label vs compact toolbar icon. */
  trigger?: "status" | "toolbar";
  disabled?: boolean;
};

/** Document type picker — status label or toolbar icon opens a pop-in menu. */
export function OperatorDocTypeMenu({
  value,
  onChange,
  trigger = "status",
  disabled = false,
}: OperatorDocTypeMenuProps) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeOperatorDocumentKind(value);
  const activeEntry =
    OPERATOR_DOC_TYPE_ENTRIES.find((entry) => entry.value === normalized) ??
    OPERATOR_DOC_TYPE_ENTRIES[0];

  return (
    <DropdownMenu
      open={disabled ? false : open}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next);
      }}
    >
      <DropdownMenuTrigger asChild disabled={disabled}>
        {trigger === "toolbar" ? (
          <CyberdeckControl
            control={{ size: "toolbar", signal: open && !disabled }}
            aria-label="Document type"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled}
            className="disabled:cursor-not-allowed disabled:opacity-30"
          >
            <img
              src={operatorIconSrc(operatorDocumentKindIcon(normalized))}
              alt=""
              aria-hidden
              draggable={false}
              className="h-3.5 w-3.5 object-contain"
            />
          </CyberdeckControl>
        ) : (
          <button
            type="button"
            aria-label={`Document type: ${activeEntry.label}. Change document type`}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-sm px-0.5 font-mono text-[9px] uppercase tracking-[0.04em] transition",
              "text-emerald-200 hover:bg-[#141414] hover:text-emerald-100",
              "disabled:cursor-not-allowed disabled:opacity-40",
              open && !disabled && "bg-[#141414] text-emerald-100",
            )}
          >
            {activeEntry.label}
            <LuChevronDown className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={trigger === "toolbar" ? "end" : "start"}
        sideOffset={6}
        className={cn(
          DOC_TYPE_MENU_PANEL_CLASS,
          "rounded-sm border-2 border-[#2d2d2d] bg-black p-1 text-emerald-100 shadow-none",
          `[&_img]:size-3.5 [&_img]:shrink-0`,
        )}
        style={{ minWidth: DOC_TYPE_MENU_MIN_WIDTH }}
      >
        <div
          className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#8a8a8a]"
          role="presentation"
        >
          Document type
        </div>
        <div className="mx-0 my-1 h-px bg-[#2d2d2d]" role="separator" />
        {OPERATOR_DOC_TYPE_ENTRIES.map((entry) => {
          const selected = entry.value === normalized;
          return (
            <DropdownMenuItem
              key={entry.value}
              className={cn(
                DOC_TYPE_MENU_ITEM_CLASS,
                selected && "text-emerald-200",
              )}
              onSelect={(event) => {
                event.preventDefault();
                onChange(entry.value);
                setOpen(false);
              }}
            >
              <img
                src={operatorIconSrc(operatorDocumentKindIcon(entry.value))}
                alt=""
                aria-hidden
                draggable={false}
                className="block size-3.5 object-contain"
              />
              <span>{entry.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
