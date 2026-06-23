"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveFigletPickerValue,
  useFigletFontCatalog,
} from "@/lib/use-figlet-font-catalog";
import { cn } from "@/lib/utils";

type FigletFontListPickerProps = {
  value: string;
  onChange: (font: string) => void;
  onSelect?: () => void;
  className?: string;
};

/** Scrollable figlet font list — alternative to the Price Is Right rolling wheel. */
export function FigletFontListPicker({
  value,
  onChange,
  onSelect,
  className,
}: FigletFontListPickerProps) {
  const { pickerFonts, loadError } = useFigletFontCatalog();
  const [filter, setFilter] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const resolvedValue = resolveFigletPickerValue(value, pickerFonts);

  useEffect(() => {
    if (resolvedValue === value) return;
    onChange(resolvedValue);
  }, [resolvedValue, value, onChange]);

  const filteredFonts = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return pickerFonts;
    return pickerFonts.filter((font) => font.toLowerCase().includes(query));
  }, [filter, pickerFonts]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [resolvedValue, filter]);

  const pickFont = (font: string) => {
    onChange(font);
    onSelect?.();
  };

  return (
    <div
      className={cn(
        "flex h-[8.25rem] min-w-0 flex-col overflow-hidden rounded-sm border border-[#2d2d2d] bg-black",
        className,
      )}
      role="group"
      aria-label="Figlet font list"
    >
      <div className="shrink-0 border-b border-[#1c1c1c] px-2 py-1">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter fonts…"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Filter figlet fonts"
          className="w-full border-0 bg-transparent font-mono text-[9px] tracking-[0.04em] text-emerald-200 placeholder:text-[#5a6a62] focus:outline-none"
        />
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Figlet fonts"
        aria-activedescendant={`figlet-font-${resolvedValue.replace(/\s+/g, "-")}`}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto"
      >
        {loadError ? (
          <p className="px-2 py-2 font-mono text-[9px] text-amber-300/90">{loadError}</p>
        ) : filteredFonts.length === 0 ? (
          <p className="px-2 py-2 font-mono text-[9px] text-[#6a6a6a]">No fonts match.</p>
        ) : (
          filteredFonts.map((font) => {
            const selected = font === resolvedValue;
            return (
              <button
                key={font}
                ref={selected ? activeItemRef : undefined}
                id={`figlet-font-${font.replace(/\s+/g, "-")}`}
                type="button"
                role="option"
                aria-selected={selected}
                title={font}
                onClick={() => pickFont(font)}
                className={cn(
                  "block w-full truncate px-2 py-1 text-left font-mono text-[9px] tracking-[0.04em] transition",
                  selected
                    ? "bg-emerald-950/50 text-emerald-200"
                    : "text-[#8ca39a] hover:bg-[#141414] hover:text-emerald-100",
                )}
              >
                {font}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
