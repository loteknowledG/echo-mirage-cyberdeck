'use client';

import { useCallback, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  OPERATOR_DOC_TYPE_ENTRIES,
  operatorDocTypeIndex,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";

const OPERATOR_TOOLTIP_CONTENT =
  "z-50 rounded border border-[#2d2d2d] bg-black px-2 py-1 text-right font-mono text-[9px] tracking-[0.06em] text-emerald-200 shadow-md";

const OPERATOR_TYPE_ICON_BTN =
  "inline-flex h-4 w-7 shrink-0 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200";

type OperatorDocTypePickerProps = {
  value: OperatorDocumentPickerKind;
  onChange: (kind: OperatorDocumentPickerKind) => void;
};

/** Compact Y-axis Embla picker — one icon visible, looped, bumpers above/below. */
export function OperatorDocTypePicker({ value, onChange }: OperatorDocTypePickerProps) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: "y",
    loop: true,
    align: "center",
    containScroll: false,
    dragFree: false,
  });

  const snapIndex = useCallback((index: number) => {
    const count = OPERATOR_DOC_TYPE_ENTRIES.length;
    return ((index % count) + count) % count;
  }, []);

  const emitSelection = useCallback(
    (index: number) => {
      const entry = OPERATOR_DOC_TYPE_ENTRIES[snapIndex(index)];
      if (!entry || entry.value === valueRef.current) return;
      onChange(entry.value);
    },
    [onChange, snapIndex],
  );

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      emitSelection(emblaApi.selectedScrollSnap());
    };

    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    emblaApi.scrollTo(operatorDocTypeIndex(valueRef.current), true);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, emitSelection]);

  useEffect(() => {
    if (!emblaApi) return;
    const index = operatorDocTypeIndex(value);
    if (emblaApi.selectedScrollSnap() !== index) {
      emblaApi.scrollTo(index);
    }
  }, [emblaApi, value]);

  const activeEntry =
    OPERATOR_DOC_TYPE_ENTRIES.find((entry) => entry.value === value) ??
    OPERATOR_DOC_TYPE_ENTRIES[0];

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex shrink-0 flex-col items-center rounded border border-[#2d2d2d] bg-black"
        aria-label="Document type"
      >
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          className={OPERATOR_TYPE_ICON_BTN}
          aria-label="Previous document type"
        >
          <LuChevronUp className="h-3 w-3" />
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <div ref={emblaRef} className="h-7 w-7 cursor-default overflow-hidden touch-pan-y">
              <div className="flex h-full flex-col">
                {OPERATOR_DOC_TYPE_ENTRIES.map((entry) => {
                  const Icon = entry.Icon;
                  const isActive = entry.value === value;
                  return (
                    <div
                      key={entry.value}
                      className="flex min-h-0 flex-[0_0_100%] items-center justify-center"
                    >
                      <Icon
                        className={`h-3.5 w-3.5 ${isActive ? "text-emerald-200" : "text-[#8a8a8a]"}`}
                        aria-hidden
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" align="end" sideOffset={6} className={OPERATOR_TOOLTIP_CONTENT}>
            {activeEntry.label}
          </TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          className={OPERATOR_TYPE_ICON_BTN}
          aria-label="Next document type"
        >
          <LuChevronDown className="h-3 w-3" />
        </button>
      </div>
    </TooltipProvider>
  );
}
