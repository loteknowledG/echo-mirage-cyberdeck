"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  cdxIconCopy,
  cdxIconEdit,
  cdxIconEye,
  cdxIconPaste,
  cdxIconRedo,
  cdxIconTrash,
  cdxIconUndo,
} from "@wikimedia/codex-icons";
import { LuScanLine } from "react-icons/lu";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDeckMode } from "@/lib/deck-mode";
import {
  LEGACY_SEND_CONTROL,
  realmorphismControlClass,
} from "@/lib/cyberdeck/realmorphism-control";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { GlyphEnginePicker } from "@/components/cyberdeck/glyph-engine-picker";
import { FigletFontPicker } from "@/components/cyberdeck/figlet-font-picker";
import { OnelineArtPicker } from "@/components/cyberdeck/oneline-art-picker";
import {
  CyberdeckControlTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  GLYPH_CHANNEL_DEFAULT_TEXT,
  GLYPH_CHANNEL_STORAGE_KEY,
  GLYPH_MODE_UPDATE_EVENT,
  GLYPH_PANE_MODE_UPDATE_EVENT,
  mergeGlyphChannelContent,
  writeGlyphPaneSettings,
  defaultGlyphChannelMerge,
  glyphEngineStatusLabel,
  glyphEngineUsesFigletFont,
  type GlyphPaneEngine,
  type GlyphPaneSettings,
  normalizeGlyphChannelText,
  readGlyphModeActive,
  readGlyphPaneSettings,
  insertGlyphChannelTextAt,
  renderGlyphOutput,
  setGlyphChannelContent,
  subscribeGlyphChannelContent,
  writeGlyphModeActive,
} from "@/lib/glyph-channel";
import { CodexIcon } from "@/components/codex-icon";
import { isFigletAllFonts } from "@/lib/figlet-fonts";
import { resolveGlyphCommand } from "@/lib/muthur-glyph-intent";
import { useGlyphTextHistory } from "@/lib/use-glyph-text-history";
import { get } from "idb-keyval";

const HEADER_ICON_BTN =
  "inline-flex h-7 w-7 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200";

const STATUS_BTN =
  "rounded border border-[#2d2d2d] bg-black px-1.5 py-0.5 font-mono text-[9px] tracking-[0.06em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200";

type EchoMirageClipboardApi = { readText?: () => Promise<string> };

async function readEchoMirageClipboardText(): Promise<string> {
  const bridge = (window as Window & { echoMirageClipboard?: EchoMirageClipboardApi })
    .echoMirageClipboard;
  if (bridge?.readText) {
    try {
      return await bridge.readText();
    } catch {
      /* fall through */
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  return "";
}

type GlyphPaneMode = "view" | "edit";

export function CyberdeckGlyphChannelPaneBody() {
  const deckMode = useDeckMode();
  const history = useGlyphTextHistory(GLYPH_CHANNEL_DEFAULT_TEXT);
  const {
    text,
    canUndo,
    canRedo,
    setText: setHistoryText,
    undo,
    redo,
    reset: resetHistory,
  } = history;
  const [hydrated, setHydrated] = useState(false);
  const [composer, setComposer] = useState("");
  const [settings, setSettings] = useState<GlyphPaneSettings>(() => readGlyphPaneSettings());
  const [statusLine, setStatusLine] = useState("⟁ READY");
  const [rendering, setRendering] = useState(false);
  const [glyphModeOn, setGlyphModeOn] = useState(false);
  const [paneMode, setPaneMode] = useState<GlyphPaneMode>("view");
  const [inputFocused, setInputFocused] = useState(false);
  const [cursorBlinkOn, setCursorBlinkOn] = useState(true);
  const [cursorLeft, setCursorLeft] = useState(0);
  const [cursorTop, setCursorTop] = useState(0);
  const [cursorHeight, setCursorHeight] = useState(20);
  const [caretIndex, setCaretIndex] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretMeasureRef = useRef<HTMLSpanElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const signalScrollRef = useRef<HTMLDivElement>(null);
  const scrollFigletAfterTextRef = useRef(false);

  const syncComposerCaret = useCallback(() => {
    const el = inputRef.current;
    const band = el?.parentElement;
    const measure = caretMeasureRef.current;
    if (!el || !band || !measure) return;

    const idx = el.selectionStart ?? 0;
    setCaretIndex(idx);

    const computed = window.getComputedStyle(el);
    measure.style.font = computed.font;
    measure.style.letterSpacing = computed.letterSpacing;
    measure.textContent = composer.slice(0, idx);

    const padLeft = Number.parseFloat(computed.paddingLeft) || 0;
    const textWidth = measure.offsetWidth;
    const left = el.offsetLeft + padLeft + textWidth - el.scrollLeft;

    const bandRect = band.getBoundingClientRect();
    const inputRect = el.getBoundingClientRect();
    const parsedLineHeight = Number.parseFloat(computed.lineHeight);
    const parsedFontSize = Number.parseFloat(computed.fontSize) || 14;
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : parsedFontSize * 1.25;
    const top =
      inputRect.top - bandRect.top + (inputRect.height - lineHeight) / 2;

    setCursorLeft(left);
    setCursorTop(top);
    setCursorHeight(lineHeight);
  }, [composer]);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el || el.disabled) return;
      el.focus({ preventScroll: true });
      const end = el.value.length;
      el.setSelectionRange(end, end);
      setInputFocused(true);
      syncComposerCaret();
    });
  }, [syncComposerCaret]);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el || el.disabled) return;
      el.focus({ preventScroll: true });
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }, []);

  const setPaneModeWithFocus = useCallback(
    (next: GlyphPaneMode) => {
      setPaneMode(next);
      if (next === "edit") {
        setStatusLine("⟁ EDIT MODE // direct signal edit");
        focusEditor();
        return;
      }
      setStatusLine("⟁ VIEW MODE");
      focusComposer();
    },
    [focusComposer, focusEditor],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await get<string>(GLYPH_CHANNEL_STORAGE_KEY);
        if (!mounted) return;
        if (typeof saved === "string" && saved.trim()) {
          resetHistory(normalizeGlyphChannelText(saved));
        }
        setSettings(readGlyphPaneSettings());
      } catch {
        /* use default */
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () =>
      subscribeGlyphChannelContent((next, options) => {
        setHistoryText(next, "immediate");
        if (options?.scrollToBottom) scrollFigletAfterTextRef.current = true;
      }),
    [setHistoryText],
  );

  useLayoutEffect(() => {
    if (!scrollFigletAfterTextRef.current) return;
    scrollFigletAfterTextRef.current = false;
    const el = signalScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, left: 0, behavior: "smooth" });
  }, [text]);

  useEffect(() => {
    setGlyphModeOn(readGlyphModeActive());
    const handler = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active;
      if (typeof active === "boolean") setGlyphModeOn(active);
    };
    window.addEventListener(GLYPH_MODE_UPDATE_EVENT, handler);
    return () => window.removeEventListener(GLYPH_MODE_UPDATE_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: "view" | "edit" }>).detail?.mode;
      if (mode === "view" || mode === "edit") setPaneModeWithFocus(mode);
    };
    window.addEventListener(GLYPH_PANE_MODE_UPDATE_EVENT, handler);
    return () => window.removeEventListener(GLYPH_PANE_MODE_UPDATE_EVENT, handler);
  }, [setPaneModeWithFocus]);

  useEffect(() => {
    if (!hydrated) return;
    writeGlyphPaneSettings(settings);
  }, [hydrated, settings]);

  useEffect(() => {
    if (!inputFocused || rendering) {
      setCursorBlinkOn(true);
      return;
    }
    const id = window.setInterval(() => {
      setCursorBlinkOn((prev) => !prev);
    }, 530);
    return () => window.clearInterval(id);
  }, [inputFocused, rendering]);

  useLayoutEffect(() => {
    if (!inputFocused) return;
    syncComposerCaret();
  }, [composer, caretIndex, inputFocused, syncComposerCaret]);

  const persistOutput = useCallback((next: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void setGlyphChannelContent(next).catch(() => undefined);
    }, 200);
  }, []);

  const applyOutput = useCallback(
    (next: string, historyMode: "immediate" | "debounced" | "skip" = "immediate") => {
      const normalized = normalizeGlyphChannelText(next);
      setHistoryText(normalized, historyMode);
      if (hydrated) persistOutput(normalized);
    },
    [setHistoryText, hydrated, persistOutput],
  );

  const handleUndo = useCallback(() => {
    const restored = undo();
    if (restored == null) return;
    if (hydrated) void setGlyphChannelContent(restored).catch(() => undefined);
    setStatusLine("⟁ UNDO");
  }, [undo, hydrated]);

  const handleRedo = useCallback(() => {
    const restored = redo();
    if (restored == null) return;
    if (hydrated) void setGlyphChannelContent(restored).catch(() => undefined);
    setStatusLine("⟁ REDO");
  }, [redo, hydrated]);

  const runRender = useCallback(
    async (
      engine: GlyphPaneEngine,
      payload: string,
      options?: { font?: string; merge?: "append" | "replace"; decorate?: boolean },
    ) => {
      const editSelection =
        paneMode === "edit" && editorRef.current
          ? {
              start: editorRef.current.selectionStart ?? text.length,
              end: editorRef.current.selectionEnd ?? text.length,
            }
          : null;

      const figletFont = options?.font?.trim() || settings.figletFont;
      const usesFigletFont = glyphEngineUsesFigletFont(engine);
      if (usesFigletFont && options?.font?.trim()) {
        setSettings((prev) => {
          const next = { ...prev, figletFont: options.font!.trim() };
          writeGlyphPaneSettings(next);
          return next;
        });
      }

      setRendering(true);
      setStatusLine(
        engine === "figlet" && isFigletAllFonts(figletFont)
          ? "⟁ RENDERING // ALL FONTS"
          : `⟁ RENDERING // ${glyphEngineStatusLabel(engine)}`,
      );
      try {
        const output = await renderGlyphOutput({
          engine,
          text: payload,
          font: usesFigletFont ? figletFont : undefined,
          decorate: options?.decorate ?? false,
        });
        const normalizedOutput = normalizeGlyphChannelText(output);
        let merged: string;
        let caretAfter: number | null = null;
        const mergeMode =
          options?.merge ?? defaultGlyphChannelMerge(Boolean(text.trim()));

        if (editSelection) {
          merged = insertGlyphChannelTextAt(
            text,
            editSelection.start,
            editSelection.end,
            normalizedOutput,
          );
          caretAfter = editSelection.start + normalizedOutput.length;
        } else {
          merged = mergeGlyphChannelContent(text, normalizedOutput, mergeMode);
        }

        applyOutput(merged);
        if (!editSelection && mergeMode === "append") {
          scrollFigletAfterTextRef.current = true;
        }
        setSettings((prev) => ({ ...prev, engine }));
        const preview = payload.replace(/\s+/g, " ").trim().slice(0, 32);
        const previewSuffix = preview.length < payload.trim().length ? "…" : "";
        setStatusLine(
          engine === "figlet"
            ? isFigletAllFonts(figletFont)
              ? `⟁ FIGLET // ALL // ${preview}${previewSuffix}`
              : `⟁ FIGLET // ${figletFont} // ${preview}${previewSuffix}`
            : engine === "oneline"
              ? `⟁ 1 LINE ASCII // ${preview}${previewSuffix}`
              : `⟁ TEXT // OK`,
        );

        requestAnimationFrame(() => {
          if (paneMode === "edit" && editorRef.current) {
            const el = editorRef.current;
            el.focus({ preventScroll: true });
            if (caretAfter != null) {
              el.setSelectionRange(caretAfter, caretAfter);
            }
          } else if (paneMode === "edit") {
            focusEditor();
          } else {
            focusComposer();
          }
        });
      } catch (err) {
        setStatusLine(
          `⟁ FAILED // ${err instanceof Error ? err.message : "Render failed"}`,
        );
        requestAnimationFrame(() => {
          if (paneMode === "edit") focusEditor();
          else focusComposer();
        });
      } finally {
        setRendering(false);
      }
    },
    [applyOutput, focusComposer, focusEditor, paneMode, settings.figletFont, text],
  );

  const handleComposerSubmit = useCallback(async () => {
    const line = composer.trim();
    if (!line || rendering) return;

    const command = resolveGlyphCommand(line);
    setComposer("");

    if (command?.kind === "mode-on") {
      writeGlyphModeActive(true);
      setStatusLine("⟁ ASCII MODE ON // compose here");
      inputRef.current?.focus();
      return;
    }
    if (command?.kind === "mode-off") {
      writeGlyphModeActive(false);
      setStatusLine("⟁ ASCII MODE OFF");
      return;
    }
    if (command?.kind === "clear") {
      applyOutput("");
      setStatusLine("⟁ CHANNEL CLEARED");
      return;
    }
    if (command?.kind === "copy") {
      try {
        await copyTextToClipboard(text);
        setStatusLine("⟁ COPIED");
      } catch {
        setStatusLine("⟁ COPY FAILED");
      }
      return;
    }
    if (command?.kind === "edit-on") {
      setPaneModeWithFocus("edit");
      return;
    }
    if (command?.kind === "edit-off") {
      setPaneModeWithFocus("view");
      return;
    }
    if (command?.kind === "ascii-skill") {
      setRendering(true);
      setStatusLine(`⟁ RENDERING // ${command.request.template.toUpperCase()}`);
      try {
        const res = await fetch("/api/ascii/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command.request),
        });
        const payload = (await res.json()) as { ok?: boolean; output?: string; error?: string };
        if (!payload.ok || typeof payload.output !== "string") {
          throw new Error(payload.error || "ascii.render failed");
        }
        const mergeMode = command.request.merge ?? "append";
        const merged = mergeGlyphChannelContent(
          text,
          payload.output,
          mergeMode === "replace" ? "replace" : "append",
        );
        applyOutput(merged);
        if (mergeMode === "append") scrollFigletAfterTextRef.current = true;
        setStatusLine(`⟁ ${command.request.template} // ${command.request.style ?? "echo_mirage"}`);
      } catch (err) {
        setStatusLine(`⟁ FAILED // ${err instanceof Error ? err.message : "ascii.render failed"}`);
      } finally {
        setRendering(false);
      }
      return;
    }
    if (command?.kind === "render") {
      await runRender(command.engine, command.text, {
        font: command.font,
        merge: command.merge,
        decorate: command.decorate,
      });
      return;
    }

    await runRender(settings.engine, line);
  }, [applyOutput, composer, rendering, runRender, setPaneModeWithFocus, settings.engine, text]);

  const handleClear = useCallback(() => {
    if (!text.trim()) return;
    applyOutput("");
    setStatusLine("⟁ CHANNEL CLEARED");
    focusComposer();
  }, [applyOutput, focusComposer, text]);

  const handleCopy = useCallback(async () => {
    try {
      await copyTextToClipboard(text);
      setStatusLine("⟁ COPIED");
    } catch {
      setStatusLine("⟁ COPY FAILED");
    }
  }, [text]);

  const handlePasteClipboard = useCallback(async () => {
    try {
      const clipboardText = await readEchoMirageClipboardText();
      if (!clipboardText.trim()) {
        setStatusLine("⟁ PASTE FAILED // empty clipboard");
        return;
      }
      applyOutput(clipboardText);
      setPaneModeWithFocus("edit");
      setStatusLine("⟁ PASTED");
    } catch {
      setStatusLine("⟁ PASTE FAILED");
    }
  }, [applyOutput, setPaneModeWithFocus]);

  const toolbarIconBtn = (disabled?: boolean) =>
    `${HEADER_ICON_BTN}${disabled ? " disabled:opacity-40 disabled:pointer-events-none" : ""}`;

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-black">
      <CyberdeckPaneHeader
        left={
          <div className="flex items-center gap-2">
            <LuScanLine className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" aria-hidden />
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                ⟁ ASCII
              </CyberdeckPaneHeaderTitle>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-1">
            <CyberdeckControlTooltip label="View">
              <button
                type="button"
                onClick={() => setPaneModeWithFocus("view")}
                aria-label="View mode"
                aria-pressed={paneMode === "view"}
                className={realmorphismControlClass(deckMode, {
                  size: "toolbar",
                  signal: paneMode === "view",
                  legacyClassName: `${HEADER_ICON_BTN} ${
                    paneMode === "view" ? "border-emerald-500/60 text-emerald-200" : ""
                  }`,
                })}
              >
                <CodexIcon icon={cdxIconEye} className="h-3.5 w-3.5" />
              </button>
            </CyberdeckControlTooltip>
            <Switch
              checked={paneMode === "edit"}
              onCheckedChange={(checked) => setPaneModeWithFocus(checked ? "edit" : "view")}
              aria-label="Toggle ASCII edit mode"
              className={cn(
                "realmorphism-switch",
                deckMode === "ascii" &&
                  "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]",
              )}
            />
            <CyberdeckControlTooltip label="Edit">
              <button
                type="button"
                onClick={() => setPaneModeWithFocus("edit")}
                aria-label="Edit mode"
                aria-pressed={paneMode === "edit"}
                className={realmorphismControlClass(deckMode, {
                  size: "toolbar",
                  signal: paneMode === "edit",
                  legacyClassName: `${HEADER_ICON_BTN} ${
                    paneMode === "edit" ? "border-emerald-500/60 text-emerald-200" : ""
                  }`,
                })}
              >
                <CodexIcon icon={cdxIconEdit} className="h-3.5 w-3.5" />
              </button>
            </CyberdeckControlTooltip>
          </div>
        }
      />

      <div
        data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
        className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-[#141414] bg-black px-3 py-2"
      >
        <CyberdeckControlTooltip label="Undo">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo || rendering}
            aria-label="Undo"
            className={realmorphismControlClass(deckMode, {
              size: "toolbar",
              signal: true,
              legacyClassName: toolbarIconBtn(!canUndo || rendering),
            })}
          >
            <CodexIcon icon={cdxIconUndo} className="h-3.5 w-3.5" />
          </button>
        </CyberdeckControlTooltip>
        <CyberdeckControlTooltip label="Redo">
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo || rendering}
            aria-label="Redo"
            className={realmorphismControlClass(deckMode, {
              size: "toolbar",
              signal: true,
              legacyClassName: toolbarIconBtn(!canRedo || rendering),
            })}
          >
            <CodexIcon icon={cdxIconRedo} className="h-3.5 w-3.5" />
          </button>
        </CyberdeckControlTooltip>
        <CyberdeckControlTooltip label="Copy ASCII">
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label="Copy ASCII"
            className={realmorphismControlClass(deckMode, {
              size: "toolbar",
              signal: true,
              legacyClassName: HEADER_ICON_BTN,
            })}
          >
            <CodexIcon icon={cdxIconCopy} className="h-3.5 w-3.5" />
          </button>
        </CyberdeckControlTooltip>
        <CyberdeckControlTooltip label="Clear ASCII channel">
          <button
            type="button"
            onClick={handleClear}
            disabled={!text.trim() || rendering}
            aria-label="Clear ASCII channel"
            className={realmorphismControlClass(deckMode, {
              size: "toolbar",
              signal: true,
              legacyClassName: toolbarIconBtn(!text.trim() || rendering),
            })}
          >
            <CodexIcon icon={cdxIconTrash} className="h-3.5 w-3.5" />
          </button>
        </CyberdeckControlTooltip>
        <CyberdeckControlTooltip label="Paste into ASCII">
          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            aria-label="Paste into ASCII"
            className={realmorphismControlClass(deckMode, {
              size: "toolbar",
              signal: true,
              legacyClassName: HEADER_ICON_BTN,
            })}
          >
            <CodexIcon icon={cdxIconPaste} className="h-3.5 w-3.5" />
          </button>
        </CyberdeckControlTooltip>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          ref={signalScrollRef}
          className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto bg-black p-3"
        >
          {paneMode === "edit" ? (
            <Textarea
              ref={editorRef}
              value={text}
              onChange={(event) => applyOutput(event.target.value, "debounced")}
              onKeyDown={(event) => {
                if (!event.ctrlKey && !event.metaKey) return;
                const key = event.key.toLowerCase();
                if (key === "z" && !event.shiftKey) {
                  event.preventDefault();
                  handleUndo();
                  return;
                }
                if (key === "y" || (key === "z" && event.shiftKey)) {
                  event.preventDefault();
                  handleRedo();
                }
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              wrap="off"
              aria-label="ASCII editor"
              className="m-0 block min-h-full w-full max-w-full resize-none overflow-visible rounded-none border-0 bg-black p-0 font-mono text-emerald-300/95 shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500/40"
              style={{
                fontSize: `${(11 * settings.zoomPercent) / 100}px`,
                lineHeight: 1.2,
                textShadow: "0 0 8px rgba(52, 211, 153, 0.12)",
              }}
            />
          ) : (
            <pre
              className="m-0 block max-w-full whitespace-pre font-mono text-emerald-300/95 transition-[font-size] duration-150"
              style={{
                fontSize: `${(11 * settings.zoomPercent) / 100}px`,
                lineHeight: 1.2,
                textShadow: "0 0 8px rgba(52, 211, 153, 0.12)",
              }}
            >
              {text}
            </pre>
          )}
        </div>

        <footer className="cyberdeck-message-box w-full min-w-0 max-w-full shrink-0 bg-black p-0">
          <div className="glyph-channel-composer rounded-sm border border-green-900/70 bg-black transition-colors focus-within:border-green-500/80 focus-within:shadow-[0_0_0_1px_rgba(34,197,94,0.45)_inset]">
            <div className="glyph-channel-composer__input-band relative flex min-w-0 items-center px-2 py-1.5">
              <span className="pointer-events-none absolute left-3 z-10 text-lg font-bold text-green-500">
                $
              </span>
              <span
                ref={caretMeasureRef}
                aria-hidden
                className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre font-mono text-sm"
              />
              <input
                ref={inputRef}
                value={composer}
                onChange={(event) => {
                  setComposer(event.target.value);
                  setCaretIndex(event.target.selectionStart ?? event.target.value.length);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void handleComposerSubmit();
                }}
                onKeyUp={syncComposerCaret}
                onClick={syncComposerCaret}
                onSelect={syncComposerCaret}
                onScroll={syncComposerCaret}
                onFocus={() => {
                  setInputFocused(true);
                  syncComposerCaret();
                }}
                onBlur={() => setInputFocused(false)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                aria-label="ASCII command input"
                placeholder={
                  glyphModeOn
                    ? "⟁ ASCII mode — figlet ECHO MIRAGE or plain text to render"
                    : settings.engine === "oneline"
                      ? "spin rolodex below · enter to render"
                      : "figlet ECHO MIRAGE · ascii edit · ascii view · ascii clear"
                }
                className={`box-border w-full min-w-0 rounded-none border-0 bg-black py-2 pl-9 pr-4 font-mono text-sm text-green-400 placeholder:text-green-800 transition-all focus:outline-none ${
                  inputFocused ? "caret-transparent" : ""
                }`}
                disabled={rendering}
              />
              {inputFocused && !rendering && cursorBlinkOn ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inline-flex min-w-[1ch] items-center justify-center bg-green-400 font-mono text-sm text-black"
                  style={{
                    left: cursorLeft,
                    top: cursorTop,
                    height: cursorHeight,
                    lineHeight: `${cursorHeight}px`,
                  }}
                >
                  {caretIndex < composer.length ? composer[caretIndex] : "\u00A0"}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 border-t border-[#1a1a1a]">
              <div className="flex min-h-7 min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden px-2 py-1.5">
                <GlyphEnginePicker
                  value={settings.engine}
                  onChange={(engine) => {
                    setSettings((prev) => ({ ...prev, engine }));
                    focusComposer();
                  }}
                />
                {settings.engine === "figlet" ? (
                  <div className="relative z-10 min-w-0 flex-1 overflow-visible">
                    <FigletFontPicker
                      value={settings.figletFont}
                      onChange={(figletFont) =>
                        setSettings((prev) => ({ ...prev, figletFont }))
                      }
                      onWheelSettled={focusComposer}
                    />
                  </div>
                ) : null}
                {settings.engine === "oneline" ? (
                  <div className="flex h-7 min-w-0 flex-1">
                    <OnelineArtPicker
                      value={settings.onelineArtId}
                      onChange={(onelineArtId) =>
                        setSettings((prev) => ({ ...prev, onelineArtId }))
                      }
                      onWheelSettled={(entry) => {
                        setComposer(entry.content);
                        setCaretIndex(entry.content.length);
                        const preview = entry.title.replace(/\s+/g, " ").trim().slice(0, 32);
                        const previewSuffix =
                          preview.length < entry.title.trim().length ? "…" : "";
                        setStatusLine(
                          `⟁ 1 LINE // ${preview}${previewSuffix} — ENTER TO RENDER`,
                        );
                        focusComposer();
                      }}
                    />
                  </div>
                ) : null}

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <CyberdeckControlTooltip label="Decrease display zoom">
                    <button
                      type="button"
                      className={realmorphismControlClass(deckMode, {
                        size: "compact",
                        signal: true,
                        legacyClassName: STATUS_BTN,
                      })}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          zoomPercent: Math.max(50, prev.zoomPercent - 10),
                        }))
                      }
                      aria-label="Decrease display zoom"
                    >
                      −
                    </button>
                  </CyberdeckControlTooltip>
                  <span className="font-mono text-[9px] text-[#6a6a6a]">{settings.zoomPercent}%</span>
                  <CyberdeckControlTooltip label="Increase display zoom">
                    <button
                      type="button"
                      className={realmorphismControlClass(deckMode, {
                        size: "compact",
                        signal: true,
                        legacyClassName: STATUS_BTN,
                      })}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          zoomPercent: Math.min(200, prev.zoomPercent + 10),
                        }))
                      }
                      aria-label="Increase display zoom"
                    >
                      +
                    </button>
                  </CyberdeckControlTooltip>

                  <CyberdeckControlTooltip
                    label="Render"
                    disabled={!composer.trim() || rendering}
                  >
                    <button
                      type="button"
                      onClick={() => void handleComposerSubmit()}
                      disabled={!composer.trim() || rendering}
                      aria-label="Render"
                      className={realmorphismControlClass(deckMode, {
                        size: "send",
                        signal: true,
                        legacyClassName: LEGACY_SEND_CONTROL,
                      })}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                        <path
                          d="M3 11.5L20.5 3.5L13.5 20.5L11.2 13.8L3 11.5Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </CyberdeckControlTooltip>
                </div>
              </div>

              <p
                className={`min-h-[1.125rem] truncate px-2 pb-2 pt-1 font-mono text-[10px] leading-normal ${
                  rendering ? "text-amber-300" : "text-green-300"
                }`}
                title={statusLine}
              >
                {statusLine}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
    </CyberdeckPaneTooltipProvider>
  );
}
