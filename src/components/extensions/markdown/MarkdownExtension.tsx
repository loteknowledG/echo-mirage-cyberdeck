"use client";

import { useEffect, useState } from "react";
import type { DragEvent as ReactDragEvent, RefObject } from "react";
import { Streamdown } from "streamdown";

type MarkdownMode = "editor" | "viewer";

export function MarkdownExtension({
  extensionColumnRef,
}: {
  extensionColumnRef: RefObject<HTMLDivElement>;
}) {
  const [mode, setMode] = useState<MarkdownMode>("editor");
  const [markdownText, setMarkdownText] = useState<string>("");
  const [markdownName, setMarkdownName] = useState<string>("untitled.md");
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || (e.key !== "V" && e.key !== "v")) return;
      e.preventDefault();
      setMode((prev) => (prev === "editor" ? "viewer" : "editor"));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleDrop = async (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const looksMarkdown =
      file.name.toLowerCase().endsWith(".md") ||
      file.type === "text/markdown" ||
      file.type === "text/plain";
    if (!looksMarkdown) return;
    try {
      const text = await file.text();
      setMarkdownText(text);
      setMarkdownName(file.name);
      setMode("viewer");
    } catch {
      // ignore failed file read
    }
  };

  return (
    <div
      ref={extensionColumnRef}
      tabIndex={-1}
      aria-label="Extension surface"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
      className={`cyberdeck-net-pane right flex h-full min-w-0 flex-col border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:border-l ${
        isDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""
      }`}
    >
      <header className="flex shrink-0 items-center justify-between overflow-visible border-b border-gray-800 bg-black px-6 py-2">
        <div className="font-mono text-[10px] tracking-[0.08em] text-green-400">MARKDOWN EXTENSION</div>
        <button
          type="button"
          className="rounded border border-green-700 px-2 py-[2px] font-mono text-[10px] text-green-300 hover:border-green-500"
          onClick={() => setMode((prev) => (prev === "editor" ? "viewer" : "editor"))}
        >
          {mode === "editor" ? "SWITCH TO VIEWER" : "SWITCH TO EDITOR"}
        </button>
      </header>
      <div className="custom-scrollbar flex-1 overflow-y-auto bg-black p-4">
        <div className="mb-3 rounded-sm border border-green-900/70 bg-black/60 p-2 font-mono text-[10px] text-green-300/90">
          FILE: {markdownName} // MODE: {mode.toUpperCase()} // TOGGLE: CTRL+SHIFT+V
        </div>
        {mode === "editor" ? (
          <textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            placeholder="Write markdown here or drag/drop a .md file..."
            className="h-[64vh] w-full resize-y rounded-sm border border-green-900/70 bg-black p-3 font-mono text-[12px] leading-relaxed text-green-200 outline-none focus:border-green-500/80"
          />
        ) : (
          <div className="rounded-sm border border-green-900/70 bg-black/50 p-3">
            {markdownText.trim() ? (
              <Streamdown className="prose prose-invert prose-pre:bg-black prose-pre:text-green-300 max-w-none text-[12px] leading-snug text-green-200">
                {markdownText}
              </Streamdown>
            ) : (
              <div className="font-mono text-[10px] text-green-500/80">
                NO MARKDOWN CONTENT // SWITCH TO EDITOR OR DROP A .MD FILE
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

