"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyMirageQueueControl,
  getMirageQueueSnapshot,
  subscribeMirageQueueStorage,
  SURVEY_MIRAGE_ITEM_CHANGED_EVENT,
  type SurveyMirageQueueControlSource,
  type SurveyMirageQueueItem,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";

export function useMirageItemQueue(): {
  items: SurveyMirageQueueItem[];
  index: number;
  current: SurveyMirageQueueItem | null;
  lastSource: SurveyMirageQueueControlSource | null;
  refresh: () => void;
} {
  const [snapshot, setSnapshot] = useState(() => getMirageQueueSnapshot());
  const [lastSource, setLastSource] = useState<SurveyMirageQueueControlSource | null>(null);

  const refresh = useCallback(() => {
    setSnapshot(getMirageQueueSnapshot());
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = (event: Event) => {
      const source = (event as CustomEvent<{ source?: SurveyMirageQueueControlSource | null }>)
        .detail?.source;
      if (source === "mirage" || source === "powerfist") {
        setLastSource(source);
      }
      refresh();
    };
    window.addEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, onChanged);
    const unsubscribeStorage = subscribeMirageQueueStorage(refresh);
    return () => {
      window.removeEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, onChanged);
      unsubscribeStorage();
    };
  }, [refresh]);

  return {
    items: snapshot.items,
    index: snapshot.index,
    current: snapshot.current,
    lastSource,
    refresh,
  };
}

type SurveyMirageItemSelectListProps = {
  /** Where this select list is rendered — drives default control source label. */
  surface?: "mirage" | "powerfist";
  className?: string;
};

function formatItemLabel(item: SurveyMirageQueueItem, position: number): string {
  const bits = [`${position}. ${item.title}`];
  if (item.transcript?.trim()) bits.push("STT");
  if (item.imageDataUrl || item.imageRef) bits.push("img");
  return bits.join(" · ");
}

/** Shared Mirage capture queue — select directly on Mirage or via PowerFist deck cards. */
export function SurveyMirageItemSelectList({
  surface = "mirage",
  className = "",
}: SurveyMirageItemSelectListProps) {
  const { items, index, current, lastSource } = useMirageItemQueue();

  const handleSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextIndex = Number(event.target.value);
      if (!Number.isFinite(nextIndex)) return;
      applyMirageQueueControl(
        { action: "select", index: nextIndex },
        surface === "powerfist" ? "powerfist" : "mirage",
      );
    },
    [surface],
  );

  const handleStep = useCallback(
    (delta: -1 | 1) => {
      applyMirageQueueControl(
        delta === 1 ? { action: "next" } : { action: "prev" },
        surface === "powerfist" ? "powerfist" : "mirage",
      );
    },
    [surface],
  );

  const controlHint =
    lastSource === "powerfist"
      ? "last change · PowerFist"
      : lastSource === "mirage"
        ? "last change · Mirage"
        : "select an item";

  return (
    <section
      className={`flex flex-col gap-2 border-b border-[#1a1a1a] bg-[#080808] px-4 py-2 font-mono ${className}`.trim()}
      aria-label="Mirage item queue"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] tracking-[0.1em] text-fuchsia-300/90">MIRAGE ITEM QUEUE</p>
        <p className="text-[8px] text-[#6a6a6a]">{controlHint}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-[9px] text-[#6a6a6a]">
          Empty — use Echo Deck · Take Screenshot or Copy Selected to fill the list.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-[#2a2a2a] px-2 py-1 text-[9px] text-[#bdbdbd] hover:border-fuchsia-700/50 hover:text-fuchsia-200/90"
            onClick={() => handleStep(-1)}
            aria-label="Previous item"
          >
            ◀ Prev
          </button>
          <select
            value={String(index)}
            onChange={handleSelect}
            className="min-w-0 flex-1 rounded border border-[#2a2a2a] bg-black px-2 py-1.5 text-[10px] text-[#e8e8e8] outline-none focus:border-fuchsia-600/60"
            aria-label="Select Mirage queue item"
          >
            {items.map((item, itemIndex) => (
              <option key={item.id} value={itemIndex}>
                {formatItemLabel(item, itemIndex + 1)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border border-[#2a2a2a] px-2 py-1 text-[9px] text-[#bdbdbd] hover:border-fuchsia-700/50 hover:text-fuchsia-200/90"
            onClick={() => handleStep(1)}
            aria-label="Next item"
          >
            Next ▶
          </button>
        </div>
      )}

      {current ? (
        <p className="truncate text-[8px] text-[#7a7a7a]">
          Active · {current.title}
          {current.transcript ? ` · “${current.transcript.slice(0, 64)}…”` : null}
        </p>
      ) : null}
    </section>
  );
}
