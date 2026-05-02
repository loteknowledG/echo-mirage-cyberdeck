'use client';

import { CyberdeckPaneHeader, CyberdeckPaneHeaderSubtitle, CyberdeckPaneHeaderTitle, CyberdeckPaneHeaderValue } from "@/components/cyberdeck/pane-header";

type HeapEntry = {
  id: string;
  name: string;
  text: string;
  createdAt: number;
};

type HeapPaneBodyProps = {
  heapEntries: HeapEntry[];
  heapNameDraft: string;
  heapTextDraft: string;
  onHeapNameDraftChange: (nextValue: string) => void;
  onHeapTextDraftChange: (nextValue: string) => void;
  onPasteClipboard: () => void | Promise<void>;
  onSaveDraft: () => void | Promise<void>;
  onCopyEntry: (entry: HeapEntry) => void | Promise<void>;
  onOpenEntry: (entry: HeapEntry) => void;
  onDeleteEntry: (entryId: string) => void;
};

export function CyberdeckHeapPaneBody({
  heapEntries,
  heapNameDraft,
  heapTextDraft,
  onHeapNameDraftChange,
  onHeapTextDraftChange,
  onPasteClipboard,
  onSaveDraft,
  onCopyEntry,
  onOpenEntry,
  onDeleteEntry,
}: HeapPaneBodyProps) {
  return (
    <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
      <div className="flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <>
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                ECHO MIRAGE HEAP
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>LOCAL BACKFILE // INDEXEDDB</CyberdeckPaneHeaderSubtitle>
            </>
          }
          right={<CyberdeckPaneHeaderValue>{heapEntries.length} ITEMS</CyberdeckPaneHeaderValue>}
        />

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-3">
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">NEW HEAP ENTRY</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onPasteClipboard()}
                  className="rounded border border-emerald-700/70 bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  PASTE CLIPBOARD
                </button>
                <button
                  type="button"
                  onClick={() => void onSaveDraft()}
                  className="rounded border border-emerald-700/70 bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  SAVE
                </button>
              </div>
            </div>

            <input
              value={heapNameDraft}
              onChange={(event) => onHeapNameDraftChange(event.target.value)}
              placeholder="entry name / filename"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="mb-2 w-full rounded-sm border border-[#1c1c1c] bg-black px-3 py-2 font-mono text-[10px] text-green-200 outline-none transition-colors placeholder:text-[#5a5a5a] focus:border-emerald-500/60"
            />

            <textarea
              value={heapTextDraft}
              onChange={(event) => onHeapTextDraftChange(event.target.value)}
              placeholder="Paste text, markdown, or code here..."
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              wrap="off"
              className="min-h-[180px] w-full resize-none overflow-auto rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200 shadow-none outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/40"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {heapEntries.length === 0 ? (
              <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black/80 p-4 font-mono text-[10px] leading-snug text-[#8a8a8a] xl:col-span-2 2xl:col-span-3">
                HEAP IS EMPTY. PASTE A DOCUMENT OR DROP TEXT HERE TO KEEP IT AFTER REFRESH.
              </div>
            ) : (
              heapEntries.map((entry) => (
                <div key={entry.id} className="flex h-full flex-col rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[10px] tracking-[0.04em] text-green-200">
                        {entry.name}
                      </div>
                      <div className="mt-1 font-mono text-[9px] tracking-[0.04em] text-[#6f6f6f]">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onCopyEntry(entry)}
                        className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                      >
                        COPY
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenEntry(entry)}
                        className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                      >
                        OPEN
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-red-500/60 hover:text-red-200"
                      >
                        DEL
                      </button>
                    </div>
                  </div>
                  <pre className="mt-3 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-snug text-green-200">
                    {entry.text}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
