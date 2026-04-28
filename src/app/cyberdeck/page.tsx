"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { art } from "@/lib/TerminalArt";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  bindKeyboardSfx,
  unlockKeyboardSfx,
  playNavigationSound,
  playSystemSound,
  startSonarLoop,
  stopSonarLoop,
  playBleepBloop,
  playWrongDoorShut,
  playDeclined,
  playDroidDizzy400,
  playDroidDizzy401,
  playOutOfGas429,
  playRaceReadySetGo,
} from "@/lib/AudioEngine";

const PROVIDER_IDS = ["opencode", "openrouter", "openai"] as const;

const servers = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  { id: "b", glyph: "§", label: "SAMUS-MANUS" },
] as const;

const SERVER_IDS = servers.map((s) => s.id);

/** Gateway SYS lines; link phrases must match `renderGatewayMessageText` splits. */
function gatewayKeySysMessage(providerId: string): string {
  if (providerId === "openai") {
    return "ENTER OPENAI KEY BELOW. create one by visiting Open AI console.";
  }
  if (providerId === "openrouter") {
    return "ENTER OPENROUTER KEY BELOW. create one by visiting OpenRouter console.";
  }
  if (providerId === "opencode") {
    return "ENTER OPENCODE KEY BELOW. create one by visiting OpenCode console.";
  }
  return `ENTER ${providerId.toUpperCase()} KEY BELOW.`;
}

const GATEWAY_LINK_PARTS =
  /(Open AI console|OpenRouter console|OpenCode console)/g;

const GATEWAY_LINK_HREF: Record<string, string> = {
  "Open AI console": "https://platform.openai.com/settings/api-keys",
  "OpenRouter console": "https://openrouter.ai/workspaces/default/keys",
  "OpenCode console": "https://opencode.ai",
};

function renderGatewayMessageText(text: string) {
  const hasGatewayLink =
    typeof text === "string" &&
    (text.includes("Open AI console") ||
      text.includes("OpenRouter console") ||
      text.includes("OpenCode console"));
  if (hasGatewayLink) {
    const parts = text.split(GATEWAY_LINK_PARTS);
    return (
      <>
        {parts.map((part, idx) => {
          const href = GATEWAY_LINK_HREF[part];
          if (href) {
            return (
              <a
                key={idx}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline"
              >
                {part}
              </a>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </>
    );
  }
  return text;
}

export default function CyberdeckPage() {
  const [server, setServer] = useState("m");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [generatedUI, setGeneratedUI] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [inputCursorBlinkOn, setInputCursorBlinkOn] = useState(true);
  const [inputCursorLeft, setInputCursorLeft] = useState(0);
  const [inputCaretIndex, setInputCaretIndex] = useState(0);

  const [activeProvider, setActiveProvider] = useState<string>("opencode");
  /** Keyboard focus ring for provider list; Enter commits to `activeProvider`. */
  const [providerKeyboardHighlightId, setProviderKeyboardHighlightId] = useState<string | null>(null);
  /** Escape from gateway → tab rail; Escape from tab rail → gateway. Arrows move highlight while on rail. */
  const [navRailContext, setNavRailContext] = useState<"gateway" | "tabs">("gateway");
  const [serverKeyboardHighlightId, setServerKeyboardHighlightId] = useState<string | null>(null);
  /** Gateway column: keyboard highlight on model rows (arrows move providers + models as one column). */
  const [modelKeyboardHighlightId, setModelKeyboardHighlightId] = useState<string | null>(null);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [modelList, setModelList] = useState<{ id: string }[]>([]);
  const [modelByProvider, setModelByProvider] = useState<Record<string, string>>({});
  const [modelFetchStatusByProvider, setModelFetchStatusByProvider] = useState<
    Record<string, "idle" | "retrieving" | "invalid-key" | "error" | "ready">
  >(() => ({
    opencode: "idle",
    openrouter: "idle",
    openai: "idle",
  }));
  const [modelHealthByProvider, setModelHealthByProvider] = useState<
    Record<string, Record<string, string>>
  >({ opencode: {}, openrouter: {}, openai: {} });
  const [probeInFlightByProvider, setProbeInFlightByProvider] = useState<Record<string, string>>({
    opencode: "",
    openrouter: "",
    openai: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const serverRailRef = useRef<HTMLElement | null>(null);
  const chatColumnRef = useRef<HTMLDivElement>(null);
  const gatewayColumnRef = useRef<HTMLDivElement>(null);
  const cyberdeckRootRef = useRef<HTMLDivElement>(null);
  const networkFeedbackDelayRef = useRef<number | null>(null);
  const networkFeedbackRepeatRef = useRef<number | null>(null);
  const serverRef = useRef(server);
  serverRef.current = server;
  /** Forward Tab from message box alternates: gateway (right) → rail (left) → … */
  const deckTabNextRef = useRef<"gateway" | "rail">("gateway");
  const prevNavRailRef = useRef<"gateway" | "tabs">("gateway");

  const syncInputCaret = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    const idx = el.selectionStart ?? 0;
    setInputCaretIndex(idx);

    // Measure monospace text width before caret to place a block cursor overlay.
    const computed = window.getComputedStyle(el);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = computed.font;
    const before = input.slice(0, idx);
    const padLeft = Number.parseFloat(computed.paddingLeft || "0") || 0;
    const x = padLeft + ctx.measureText(before).width - el.scrollLeft;
    setInputCursorLeft(Math.max(padLeft, x));
  }, [input]);

  const providers = [
    { id: "opencode" as const, name: "OPENCODE" },
    { id: "openrouter" as const, name: "OPENROUTER" },
    { id: "openai" as const, name: "OPENAI" },
  ] as const;

  const modelID = modelByProvider[activeProvider] || "";
  const providerModelFetchStatus = modelFetchStatusByProvider[activeProvider] || "idle";
  const scanActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) || providerModelFetchStatus === "retrieving";
  const networkActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) ||
    providerModelFetchStatus === "retrieving" ||
    isStreaming;

  const inactiveTextColor = "#7a7a7a";
  const inactiveSubtleTextColor = "#6a6a6a";
  const activeTextGlow = "0 0 8px rgba(0, 255, 0, 0.22)";
  const amberTextGlow = "0 0 8px rgba(255, 170, 0, 0.22)";
  const inactiveTextGlow = "0 0 6px rgba(180, 180, 180, 0.14)";

  const playModelTestErrorSound = useCallback((line: string) => {
    if (line.includes("VALID_RESPONSE")) {
      playRaceReadySetGo();
      return;
    }
    if (line.includes("HTTP_401")) {
      playDroidDizzy401();
      return;
    }
    if (line.includes("HTTP_400")) {
      playDroidDizzy400();
      return;
    }
    if (line.includes("HTTP_429")) {
      playOutOfGas429();
      return;
    }
    if (line.includes("EMPTY_RESPONSE")) {
      playDeclined();
      return;
    }
    if (line.includes("FAILURE")) {
      playWrongDoorShut();
    }
  }, []);

  const selectProvider = useCallback((id: string) => {
    setActiveProvider(id);
    try {
      localStorage.setItem("active_provider", id);
    } catch {
      /* ignore */
    }
    playSystemSound("chirp", 0.05);
  }, []);

  const handleServerClick = useCallback((id: string) => {
    if (server !== id) {
      setServer(id);
      playSystemSound("chirp");
    } else {
      playSystemSound("click", 0.05);
    }
  }, [server]);

  /** Move real focus onto the rail when leaving gateway so Enter/arrows are not captured by chat/key inputs. */
  useLayoutEffect(() => {
    if (navRailContext === "tabs" && prevNavRailRef.current === "gateway") {
      serverRailRef.current?.focus({ preventScroll: true });
    }
    prevNavRailRef.current = navRailContext;
  }, [navRailContext]);

  const navRailContextRef = useRef(navRailContext);
  navRailContextRef.current = navRailContext;

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (navRailContextRef.current !== "tabs") return;
      const el = e.target as HTMLElement | null;
      if (!el || serverRailRef.current?.contains(el)) return;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
        setNavRailContext("gateway");
        setServerKeyboardHighlightId(null);
      }
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, []);

  // Hydrate keys / models / active provider from localStorage (weyland-compatible keys)
  useEffect(() => {
    const nextKeys: Record<string, string> = {};
    for (const id of PROVIDER_IDS) {
      const v = localStorage.getItem(`key_${id}`);
      if (v) nextKeys[id] = v;
    }
    setProviderKeys(nextKeys);
    const ap = localStorage.getItem("active_provider");
    if (ap && (PROVIDER_IDS as readonly string[]).includes(ap)) setActiveProvider(ap);
    setModelByProvider((prev) => {
      const n = { ...prev };
      for (const id of PROVIDER_IDS) {
        const m = localStorage.getItem(`ascii_model_${id}`);
        if (m) n[id] = m;
      }
      return n;
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  useEffect(() => {
    if (!isInputFocused || isStreaming) {
      setInputCursorBlinkOn(true);
      return;
    }
    const id = window.setInterval(() => {
      setInputCursorBlinkOn((prev) => !prev);
    }, 530);
    return () => window.clearInterval(id);
  }, [isInputFocused, isStreaming]);

  useLayoutEffect(() => {
    if (!isInputFocused) return;
    syncInputCaret();
  }, [input, inputCaretIndex, isInputFocused, syncInputCaret]);

  useEffect(() => {
    if (scanActivityActive) {
      startSonarLoop(3200);
    } else {
      stopSonarLoop();
    }
    return () => stopSonarLoop();
  }, [scanActivityActive]);

  useEffect(() => {
    if (isStreaming) {
      if (networkFeedbackDelayRef.current == null) {
        networkFeedbackDelayRef.current = window.setTimeout(() => {
          playBleepBloop();
          networkFeedbackRepeatRef.current = window.setInterval(() => {
            playBleepBloop();
          }, 7000);
        }, 2800);
      }
    } else {
      if (networkFeedbackDelayRef.current !== null) {
        window.clearTimeout(networkFeedbackDelayRef.current);
        networkFeedbackDelayRef.current = null;
      }
      if (networkFeedbackRepeatRef.current !== null) {
        window.clearInterval(networkFeedbackRepeatRef.current);
        networkFeedbackRepeatRef.current = null;
      }
    }
    return () => {
      if (networkFeedbackDelayRef.current !== null) {
        window.clearTimeout(networkFeedbackDelayRef.current);
        networkFeedbackDelayRef.current = null;
      }
      if (networkFeedbackRepeatRef.current !== null) {
        window.clearInterval(networkFeedbackRepeatRef.current);
        networkFeedbackRepeatRef.current = null;
      }
    };
  }, [isStreaming]);

  // When the active gateway has no stored key, mirror Weyland: one [SYS] line per provider (deduped).
  useEffect(() => {
    if (providerKeys[activeProvider]) return;
    const tip = gatewayKeySysMessage(activeProvider);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "system" && last.text === tip) return prev;
      return [...prev, { role: "system", text: tip }];
    });
  }, [activeProvider, providerKeys[activeProvider]]);

  const setModelHealth = useCallback((provider: string, model: string, status: string) => {
    setModelHealthByProvider((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [model]: status },
    }));
  }, []);

  const probeSelectedModel = useCallback(
    async (provider: string, model: string, key: string) => {
      if (!provider || !model || !key) return;
      setProbeInFlightByProvider((prev) => ({ ...prev, [provider]: model }));
      setModelHealth(provider, model, "testing");
      try {
        const res = await fetch("/api/cyberdeck-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ probe: true, provider, apiKey: key, model }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          valid?: boolean;
          rateLimited?: boolean;
          status?: number;
        };
        const failHealth = data.rateLimited ? "amber" : "grey";
        if (!res.ok || data.ok === false) {
          const line = `MODEL_TEST ${provider.toUpperCase()}/${model}: HTTP_${data.status ?? res.status}${data.rateLimited ? " RATE_LIMIT" : " FAILURE"}`;
          playModelTestErrorSound(line);
          setModelHealth(provider, model, failHealth);
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: line,
            },
          ]);
          return;
        }
        const valid = Boolean(data.valid);
        setModelHealth(provider, model, valid ? "green" : "amber");
        const line = `MODEL_TEST ${provider.toUpperCase()}/${model}: ${valid ? "VALID_RESPONSE" : "EMPTY_RESPONSE"}`;
        playModelTestErrorSound(line);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: line,
          },
        ]);
      } catch (err) {
        playModelTestErrorSound(`MODEL_TEST ${provider.toUpperCase()}/${model}: FAILURE`);
        setModelHealth(provider, model, "grey");
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `MODEL_TEST ${provider.toUpperCase()}/${model}: ${String((err as Error)?.message || err)}`,
          },
        ]);
      } finally {
        setProbeInFlightByProvider((prev) => {
          if (prev[provider] !== model) return prev;
          return { ...prev, [provider]: "" };
        });
      }
    },
    [playModelTestErrorSound, setModelHealth],
  );

  const activateModelById = useCallback(
    (modelId: string) => {
      const key = providerKeys[activeProvider];
      if (!key || !modelId) return;
      setModelByProvider((prev) => ({ ...prev, [activeProvider]: modelId }));
      try {
        localStorage.setItem(`ascii_model_${activeProvider}`, modelId);
      } catch {
        /* ignore */
      }
      playSystemSound("click", 0.05);
      void probeSelectedModel(activeProvider, modelId, key);
    },
    [activeProvider, providerKeys, probeSelectedModel],
  );

  // Column-scoped arrows: rail / chat scroll / gateway (providers + models). Tab rail: Escape; Enter on rail → gateway + provider hover.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      // Browser Find (and find-next): do not intercept — keep default keyboard behavior.
      if (e.key === "F3") return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "f" || e.key === "F" || e.key === "g" || e.key === "G"))
        return;

      const deck = cyberdeckRootRef.current;
      if (
        deck &&
        t !== document.body &&
        t !== document.documentElement &&
        !deck.contains(t)
      ) {
        return;
      }

      const inRail = !!(serverRailRef.current && serverRailRef.current.contains(t));
      const inChatCol = !!(chatColumnRef.current && chatColumnRef.current.contains(t));
      const inGateway = !!(gatewayColumnRef.current && gatewayColumnRef.current.contains(t));
      const inChatInput = messageInputRef.current !== null && t === messageInputRef.current;

      const sfxNav = {
        step: () => {
          if (!e.repeat) playNavigationSound("step");
        },
        commit: () => {
          if (!e.repeat) playNavigationSound("commit");
        },
        back: () => {
          if (!e.repeat) playNavigationSound("back");
        },
      };

      // Tab: message box ↔ closest column (gateway / rail); from gateway or rail, Tab returns to message box.
      if (e.key === "Tab" && !e.repeat) {
        const msg = messageInputRef.current;
        if (!msg || msg.disabled) {
          /* fall through */
        } else if (inGateway && !inChatInput) {
          e.preventDefault();
          sfxNav.commit();
          msg.focus({ preventScroll: false });
          return;
        } else if (inRail && !inChatInput) {
          e.preventDefault();
          sfxNav.commit();
          msg.focus({ preventScroll: false });
          return;
        } else if (inChatInput) {
          e.preventDefault();
          sfxNav.commit();
          const next = deckTabNextRef.current;
          if (e.shiftKey) {
            if (next === "gateway") {
              serverRailRef.current?.focus({ preventScroll: true });
              setNavRailContext("tabs");
              setServerKeyboardHighlightId(serverRef.current);
            } else {
              gatewayColumnRef.current?.focus({ preventScroll: true });
            }
            return;
          }
          if (next === "gateway") {
            gatewayColumnRef.current?.focus({ preventScroll: true });
            deckTabNextRef.current = "rail";
          } else {
            serverRailRef.current?.focus({ preventScroll: true });
            setNavRailContext("tabs");
            setServerKeyboardHighlightId(serverRef.current);
            deckTabNextRef.current = "gateway";
          }
          return;
        }
      }

      // Column 2 Escape: previous link (scrollIntoView so the move reads clearly); first link → blur + log surface, no wrap to bottom.
      if (e.key === "Escape" && inChatCol && !inRail && !inGateway) {
        const scroll = messageScrollRef.current;
        if (!scroll) return;
        const links = [...scroll.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((a) =>
          scroll.contains(a),
        );
        const anchor =
          t.closest("a") instanceof HTMLAnchorElement && scroll.contains(t.closest("a")!)
            ? (t.closest("a") as HTMLAnchorElement)
            : null;
        if (anchor && links.length > 0) {
          e.preventDefault();
          const i = links.indexOf(anchor);
          if (i > 0) {
            sfxNav.step();
            const prev = links[i - 1];
            prev.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
            prev.focus({ preventScroll: true });
          } else {
            sfxNav.back();
            anchor.blur();
            scroll.focus({ preventScroll: false });
          }
          return;
        }
        if (links.length > 0) {
          e.preventDefault();
          sfxNav.step();
          const last = links[links.length - 1];
          last.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
          last.focus({ preventScroll: true });
          return;
        }
        if (inChatInput) {
          e.preventDefault();
          sfxNav.step();
          scroll.focus({ preventScroll: false });
          return;
        }
        if (t === scroll) {
          e.preventDefault();
          sfxNav.commit();
          messageInputRef.current?.focus({ preventScroll: false });
          return;
        }
        return;
      }

      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (t.isContentEditable) return;

      // Escape toggles rail ↔ gateway hierarchy only in columns 1 and 3.
      if (e.key === "Escape") {
        const inOneOrThree = inRail || inGateway;
        if (!inOneOrThree) return;
        if (navRailContext === "gateway") {
          e.preventDefault();
          sfxNav.back();
          setProviderKeyboardHighlightId(null);
          setModelKeyboardHighlightId(null);
          setNavRailContext("tabs");
          setServerKeyboardHighlightId(server);
          return;
        }
        if (navRailContext === "tabs") {
          e.preventDefault();
          sfxNav.back();
          setNavRailContext("gateway");
          setServerKeyboardHighlightId(null);
          return;
        }
      }

      const navKey =
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.key === " ";

      if (navRailContext === "tabs") {
        if (inRail) {
          const sids: string[] = [...SERVER_IDS];
          const sPivot =
            serverKeyboardHighlightId ?? (sids.includes(server) ? server : sids[0]);
          let sidx = sids.indexOf(sPivot);
          if (sidx < 0) sidx = 0;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[(sidx + 1) % sids.length]);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[(sidx - 1 + sids.length) % sids.length]);
            return;
          }
          if (e.key === "Home") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[0]);
            return;
          }
          if (e.key === "End") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[sids.length - 1]);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            sfxNav.commit();
            handleServerClick(serverKeyboardHighlightId ?? sPivot);
            setNavRailContext("gateway");
            setServerKeyboardHighlightId(null);
            setModelKeyboardHighlightId(null);
            const pid =
              (PROVIDER_IDS as readonly string[]).includes(activeProvider) ? activeProvider : PROVIDER_IDS[0];
            setProviderKeyboardHighlightId(pid);
            return;
          }
        } else if (navKey) {
          e.preventDefault();
        }
        return;
      }

      if (inChatCol && !inChatInput) {
        const scrollEl = messageScrollRef.current;
        if (scrollEl) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            sfxNav.step();
            scrollEl.scrollBy({ top: 56, behavior: "smooth" });
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            sfxNav.step();
            scrollEl.scrollBy({ top: -56, behavior: "smooth" });
            return;
          }
          if (e.key === "Home") {
            e.preventDefault();
            sfxNav.step();
            scrollEl.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          if (e.key === "End") {
            e.preventDefault();
            sfxNav.step();
            scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
            return;
          }
        }
      }

      const allowGatewayKeys =
        navRailContext === "gateway" && (inGateway || (!inChatCol && !inRail));

      if (!allowGatewayKeys) return;

      const ids = [...PROVIDER_IDS];
      const pivot =
        providerKeyboardHighlightId ??
        (ids.includes(activeProvider as (typeof PROVIDER_IDS)[number]) ? activeProvider : ids[0]);
      let idx = ids.indexOf(pivot as (typeof PROVIDER_IDS)[number]);
      if (idx < 0) idx = 0;

      const models = modelList;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        sfxNav.step();
        if (modelKeyboardHighlightId != null && models.length > 0) {
          const mi = models.findIndex((m) => m.id === modelKeyboardHighlightId);
          if (mi >= 0) {
            setModelKeyboardHighlightId(models[(mi + 1) % models.length].id);
          }
          return;
        }
        if (idx >= ids.length - 1) {
          if (models.length > 0) {
            setProviderKeyboardHighlightId(null);
            setModelKeyboardHighlightId(models[0].id);
          } else {
            setProviderKeyboardHighlightId(ids[(idx + 1) % ids.length]);
          }
          return;
        }
        setProviderKeyboardHighlightId(ids[idx + 1]);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        sfxNav.step();
        if (modelKeyboardHighlightId != null && models.length > 0) {
          const mi = models.findIndex((m) => m.id === modelKeyboardHighlightId);
          if (mi <= 0) {
            setModelKeyboardHighlightId(null);
            setProviderKeyboardHighlightId(ids[ids.length - 1]);
          } else {
            setModelKeyboardHighlightId(models[mi - 1].id);
          }
          return;
        }
        if (idx <= 0) {
          if (models.length > 0) {
            setProviderKeyboardHighlightId(null);
            setModelKeyboardHighlightId(models[models.length - 1].id);
          } else {
            setProviderKeyboardHighlightId(ids[(idx - 1 + ids.length) % ids.length]);
          }
          return;
        }
        setProviderKeyboardHighlightId(ids[idx - 1]);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        sfxNav.step();
        setModelKeyboardHighlightId(null);
        setProviderKeyboardHighlightId(ids[0]);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        sfxNav.step();
        if (models.length > 0) {
          setProviderKeyboardHighlightId(null);
          setModelKeyboardHighlightId(models[models.length - 1].id);
        } else {
          setModelKeyboardHighlightId(null);
          setProviderKeyboardHighlightId(ids[ids.length - 1]);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (modelKeyboardHighlightId != null) {
          e.preventDefault();
          sfxNav.commit();
          activateModelById(modelKeyboardHighlightId);
          setModelKeyboardHighlightId(null);
          return;
        }
        if (providerKeyboardHighlightId == null) return;
        e.preventDefault();
        sfxNav.commit();
        selectProvider(providerKeyboardHighlightId);
        setProviderKeyboardHighlightId(null);
        setModelKeyboardHighlightId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    activateModelById,
    activeProvider,
    handleServerClick,
    modelKeyboardHighlightId,
    modelList,
    navRailContext,
    providerKeyboardHighlightId,
    selectProvider,
    server,
    serverKeyboardHighlightId,
  ]);

  useEffect(() => {
    const rail = serverRailRef.current;
    if (!rail) return;
    const onRailFocus = () => {
      setNavRailContext("tabs");
      setServerKeyboardHighlightId(serverRef.current);
    };
    rail.addEventListener("focusin", onRailFocus);
    return () => rail.removeEventListener("focusin", onRailFocus);
  }, []);

  useEffect(() => {
    setModelKeyboardHighlightId((prev) => {
      if (prev == null) return null;
      if (!modelList.some((m) => m.id === prev)) return null;
      return prev;
    });
  }, [activeProvider, modelList]);

  // Fetch models when provider key is present (weyland App.jsx pattern)
  useEffect(() => {
    const currentKey = providerKeys[activeProvider];
    setModelList([]);
    if (!currentKey) {
      setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "idle" }));
      return;
    }

    let cancelled = false;
    setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "retrieving" }));

    (async () => {
      try {
        const res = await fetch("/api/cyberdeck-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: activeProvider, apiKey: currentKey }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const invalid = res.status === 401 || res.status === 403;
          setModelFetchStatusByProvider((prev) => ({
            ...prev,
            [activeProvider]: invalid ? "invalid-key" : "error",
          }));
          if (invalid) {
            setProviderKeys((prev) => {
              const next = { ...prev };
              delete next[activeProvider];
              return next;
            });
            localStorage.removeItem(`key_${activeProvider}`);
            setMessages((prev) => [
              ...prev,
              { role: "system", text: `INVALID_KEY // ${activeProvider.toUpperCase()} AUTH_REJECTED` },
            ]);
          }
          return;
        }
        const json = (await res.json()) as { data?: { id: string }[] };
        const raw = Array.isArray(json.data) ? json.data : [];
        if (cancelled) return;
        setModelList(raw);
        setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "ready" }));
        setModelByProvider((prev) => {
          const current = prev[activeProvider] || "";
          const hasCurrent = current && raw.some((m) => m.id === current);
          const nextModel = hasCurrent ? current : raw[0]?.id || "";
          if (nextModel && nextModel !== current) {
            localStorage.setItem(`ascii_model_${activeProvider}`, nextModel);
            void probeSelectedModel(activeProvider, nextModel, currentKey);
          }
          return { ...prev, [activeProvider]: nextModel };
        });
      } catch {
        if (!cancelled) {
          setModelList([]);
          setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "error" }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProvider, providerKeys[activeProvider], probeSelectedModel]);

  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      void unlockKeyboardSfx();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });

    const unbind = bindKeyboardSfx(window, {
      mode: "cyberdeck",
      volume: 1.08,
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      unbind();
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsStreaming(true);
    setStreamText("");
    setGeneratedUI(null);

    // Gateway key registration (weyland: set key + LS, model fetch effect validates)
    if (!providerKeys[activeProvider]) {
      setProviderKeys((prev) => ({ ...prev, [activeProvider]: userMessage }));
      try {
        localStorage.setItem(`key_${activeProvider}`, userMessage);
      } catch {
        /* ignore */
      }
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `KEY FOR ${activeProvider.toUpperCase()} REGISTERED.` },
      ]);
      setIsStreaming(false);
      return;
    }

    if (!modelID) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "NO_MODEL_SELECTED // WAIT_FOR_MODELS_OR_CHECK_KEY" },
      ]);
      setIsStreaming(false);
      return;
    }

    try {
      const res = await fetch("/api/cyberdeck-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          provider: activeProvider,
          apiKey: providerKeys[activeProvider],
          model: modelID,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamText(fullText);
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", text: fullText }]);
      setStreamText("");

      try {
        const jsonMatch = fullText.match(/^\{[\s\S]*\}$/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.type === "providers") {
            const providersList = parsed.data
              .map(
                (p: { id: string; name: string; description: string; status: string }) =>
                  `${p.name} (${p.status}) - ${p.description}`,
              )
              .join("\n");
            setGeneratedUI(`[PROVIDERS]\n\n${providersList}`);
            return;
          }
          if (parsed.type === "models") {
            const modelsList = parsed.data
              .map(
                (m: { id: string; name: string; provider: string; status: string }) =>
                  `${m.name} [${m.provider}] - ${m.status}`,
              )
              .join("\n");
            setGeneratedUI(`[AVAILABLE MODELS]\n\n${modelsList}`);
            return;
          }
          if (parsed.type === "status") {
            const { provider, model, connection, memory } = parsed.data;
            setGeneratedUI(
              `[CONNECTION STATUS]\n\nProvider: ${provider}\nModel: ${model}\nStatus: ${connection}\nMemory: ${memory}`,
            );
            return;
          }
        }
      } catch {
        /* not JSON */
      }

      if (fullText.includes("[UI]")) {
        const uiMatch = fullText.match(/\[UI\](.*?)\[\/UI\]/s);
        if (uiMatch) setGeneratedUI(uiMatch[1].trim());
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes("API error")) {
        playWrongDoorShut();
      }
      setMessages((prev) => [...prev, { role: "error", text: String(err) }]);
    } finally {
      setIsStreaming(false);
    }
  };

  /* Weyland: col2 = nav, col3 = terminal. Echo: flipped → col2 = terminal (chat), col3 = nav (gateway). */
  return (
    <div
      ref={cyberdeckRootRef}
      className="flex h-screen overflow-hidden bg-background text-green-500 font-mono terminal-window"
    >
      <aside
        ref={serverRailRef}
        tabIndex={-1}
        aria-label="Server rail"
        className="cyberdeck-server-rail flex flex-col items-center flex-shrink-0 w-16 border-r border-gray-800 bg-gray-900 py-4 z-40 outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
      >
        {servers.map((btn) => (
          <div
            key={btn.id}
            className="btn-container"
            style={{ width: "56px", height: "52px", position: "relative" }}
          >
            <pre
              className={`ascii-btn${server === btn.id ? " is-pushed" : ""}${
                navRailContext === "tabs" && serverKeyboardHighlightId === btn.id
                  ? " server-rail-kb-hover"
                  : ""
              }`}
              onClick={() => {
                setNavRailContext("gateway");
                setServerKeyboardHighlightId(null);
                handleServerClick(btn.id);
              }}
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                cursor: "pointer",
              }}
            >
              {server === btn.id ? art.pushed(btn.glyph) : art.popped(btn.glyph)}
            </pre>
          </div>
        ))}
      </aside>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        {/* COL 2 (flipped): main terminal / chat — Weyland col3 */}
        <ResizablePanel defaultSize={55} minSize={28}>
          <div
            ref={chatColumnRef}
            className={`cyberdeck-net-pane left flex h-full min-w-0 flex-col border-r border-gray-800 bg-black ${
              networkActivityActive ? "is-net-active" : ""
            }`}
          >
            <header className="flex shrink-0 items-end justify-end overflow-visible border-b border-gray-800 bg-black px-6 py-2">
              <pre
                className="cyberdeck-net-logo m-0 whitespace-pre font-mono text-[4px] leading-[1.0] text-green-400"
                style={{ textShadow: "0 0 5px #00ff00" }}
              >
                {`
          _            _             _       _    _       
        ╱╲ ╲         ╱╲ ╲           ╱ ╱╲    ╱ ╱╲ ╱╲ ╲     
       ╱  ╲ ╲       ╱  ╲ ╲         ╱ ╱ ╱   ╱ ╱ ╱╱  ╲ ╲    
      ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲ ╲       ╱ ╱_╱   ╱ ╱ ╱╱ ╱╲ ╲ ╲   
     ╱ ╱ ╱╲ ╲_╲   ╱ ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲__╱ ╱ ╱╱ ╱ ╱╲ ╲ ╲  
    ╱ ╱_╱_ ╲╱_╱  ╱ ╱ ╱  ╲ ╲_╲   ╱ ╱╲ ╲___╲╱ ╱╱ ╱ ╱  ╲ ╲_╲ 
   ╱ ╱____╱╲    ╱ ╱ ╱    ╲╱_╱  ╱ ╱ ╱╲╱___╱ ╱╱ ╱ ╱   ╱ ╱ ╱ 
  ╱ ╱╲____╲╱   ╱ ╱ ╱          ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱   ╱ ╱ ╱  
 ╱ ╱ ╱______  ╱ ╱ ╱________  ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱___╱ ╱ ╱   
╱ ╱ ╱_______╲╱ ╱ ╱_________╲╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱____╲╱ ╱    
╲╱__________╱╲╱____________╱╲╱_╱    ╲╱_╱ ╲╱_________╱`}
              </pre>
            </header>
            <div
              ref={messageScrollRef}
              tabIndex={-1}
              className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-4 outline-none focus-visible:ring-1 focus-visible:ring-green-500/25"
            >
              <div className="message-log flex-1 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className="text-xs">
                    <span
                      className={
                        m.role === "user"
                          ? "text-gray-600"
                          : m.role === "assistant"
                            ? "text-green-400"
                            : m.role === "system"
                              ? "text-amber-400/90"
                              : "text-red-400"
                      }
                    >
                      [
                      {m.role === "user"
                        ? "USR"
                        : m.role === "assistant"
                          ? "AI"
                          : m.role === "system"
                            ? "SYS"
                            : "ERR"}
                      ]{" "}
                    </span>
                    <span className="text-gray-300">
                      {m.role === "system" ? (
                        <span className="whitespace-pre-wrap">{renderGatewayMessageText(m.text)}</span>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      )}
                    </span>
                  </div>
                ))}
                {streamText && (
                  <div className="text-xs">
                    <span className="text-green-400">[AI] </span>
                    <span className="text-green-300">{streamText}</span>
                    <span className="animate-pulse">█</span>
                  </div>
                )}
                {isStreaming && !streamText && (
                  <div className="text-xs text-green-500/90">
                    <span className="animate-pulse">█</span> COGITATING...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="border-t border-gray-800 bg-gray-900/80 p-4">
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-lg font-bold text-green-500">$</span>
                <input
                  ref={messageInputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setInputCaretIndex(e.target.selectionStart ?? e.target.value.length);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  onKeyUp={syncInputCaret}
                  onClick={syncInputCaret}
                  onSelect={syncInputCaret}
                  onFocus={() => {
                    setIsInputFocused(true);
                    syncInputCaret();
                  }}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={
                    !providerKeys[activeProvider] ? "ENTER GATEWAY KEY..." : "Enter command or message..."
                  }
                  className={`w-full rounded-lg border border-gray-700 bg-black py-3 pl-9 pr-3 font-mono text-sm text-green-400 placeholder-gray-600 transition-all focus:border-green-500 focus:outline-none ${
                    isInputFocused ? "caret-transparent" : ""
                  }`}
                  disabled={isStreaming}
                />
                {isInputFocused && !isStreaming && inputCursorBlinkOn ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2 bg-green-400 px-[1px] font-mono text-sm leading-5 text-black"
                    style={{ left: `${inputCursorLeft}px` }}
                  >
                    {input[inputCaretIndex] ? input[inputCaretIndex] : "\u00A0"}
                  </span>
                ) : null}
              </div>
            </footer>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* COL 3 (flipped): gateway nav — Weyland col2 */}
        <ResizablePanel defaultSize={45} minSize={22}>
          <div
            ref={gatewayColumnRef}
            tabIndex={-1}
            aria-label="Gateway"
            className={`cyberdeck-net-pane right flex h-full min-w-0 flex-col border-l border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              networkActivityActive ? "is-net-active" : ""
            }`}
          >
            <header className="flex shrink-0 items-center overflow-visible border-b border-gray-800 bg-black px-6 py-2">
              <pre
                className="cyberdeck-net-logo m-0 whitespace-pre font-mono text-[4px] leading-[1.0] text-green-400"
                style={{ textShadow: "0 0 5px #00ff00" }}
              >
                {`
        _   _          _          _           _                   _              _      
       ╱╲_╲╱╲_╲ _     ╱╲ ╲       ╱╲ ╲        ╱ ╱╲                ╱╲ ╲           ╱╲ ╲    
      ╱ ╱ ╱ ╱ ╱╱╲_╲   ╲ ╲ ╲     ╱  ╲ ╲      ╱ ╱  ╲              ╱  ╲ ╲         ╱  ╲ ╲   
     ╱╲ ╲╱ ╲ ╲╱ ╱ ╱   ╱╲ ╲_╲   ╱ ╱╲ ╲ ╲    ╱ ╱ ╱╲ ╲            ╱ ╱╲ ╲_╲       ╱ ╱╲ ╲ ╲  
    ╱  ╲____╲__╱ ╱   ╱ ╱╲╱_╱  ╱ ╱ ╱╲ ╲_╲  ╱ ╱ ╱╲ ╲ ╲          ╱ ╱ ╱╲╱_╱      ╱ ╱ ╱╲ ╲_╲ 
   ╱ ╱╲╱________╱   ╱ ╱ ╱    ╱ ╱ ╱_╱ ╱ ╱ ╱ ╱ ╱  ╲ ╲ ╲        ╱ ╱ ╱ ______   ╱ ╱_╱_ ╲╱_╱ 
  ╱ ╱ ╱╲╱_╱╱ ╱ ╱   ╱ ╱ ╱    ╱ ╱ ╱__╲╱ ╱ ╱ ╱ ╱___╱ ╱╲ ╲      ╱ ╱ ╱ ╱╲_____╲ ╱ ╱____╱╲    
 ╱ ╱ ╱    ╱ ╱ ╱   ╱ ╱ ╱    ╱ ╱ ╱_____╱ ╱ ╱ ╱_____╱ ╱╲ ╲    ╱ ╱ ╱  ╲╱____ ╱╱ ╱╲____╲╱    
╱ ╱ ╱    ╱ ╱ ╱___╱ ╱ ╱__  ╱ ╱ ╱╲ ╲ ╲  ╱ ╱_________╱╲ ╲ ╲  ╱ ╱ ╱_____╱ ╱ ╱╱ ╱ ╱______    
╲╱_╱    ╱ ╱ ╱╱╲__╲╱_╱___╲╱ ╱ ╱  ╲ ╲ ╲╱ ╱ ╱_       __╲ ╲_╲╱ ╱ ╱______╲╱ ╱╱ ╱ ╱_______╲   
        ╲╱_╱ ╲╱_________╱╲╱_╱    ╲_╲╱╲_╲___╲     ╱____╱_╱╲╱___________╱ ╲╱__________╱`}
              </pre>
            </header>
            <div className="custom-scrollbar flex-1 overflow-y-auto bg-gray-900 p-4">
              <div
                className="pb-2 font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]"
                style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
              >
                MAINNET-UPLINK
              </div>

              <div
                className="cursor-default py-1 font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]"
                style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
              >
                # GATEWAY
              </div>

              <div className="mt-1 flex select-none flex-col font-mono text-[10px] tracking-[0.04em]">
                {providers.map((p) => {
                  const selected = activeProvider === p.id;
                  const kbHover = providerKeyboardHighlightId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`nav-row cursor-pointer py-[5px]${kbHover ? " nav-row-kb-hover" : ""}`}
                      style={
                        {
                          "--nav-color": selected ? "#00ff00" : inactiveSubtleTextColor,
                          "--nav-shadow": selected ? activeTextGlow : inactiveTextGlow,
                          "--nav-hover-color": selected ? "#36ff73" : "#b0b0b0",
                          "--nav-hover-shadow": selected
                            ? "0 0 10px rgba(54, 255, 115, 0.30)"
                            : inactiveTextGlow,
                        } as CSSProperties
                      }
                      onClick={() => {
                        selectProvider(p.id);
                        setProviderKeyboardHighlightId(null);
                        setModelKeyboardHighlightId(null);
                      }}
                    >
                      {selected ? "[X] " : "[ ] "}
                      {p.name}
                    </div>
                  );
                })}
              </div>

              <div
                className="mt-5 border-t border-[#111] pt-2"
                style={{
                  pointerEvents: probeInFlightByProvider[activeProvider] ? "none" : "auto",
                  opacity: probeInFlightByProvider[activeProvider] ? 0.7 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <div
                  className="mb-2 font-mono text-[10px]"
                  style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}
                >
                  AVAILABLE_MODELS:
                </div>
                {!providerKeys[activeProvider] ? null : providerModelFetchStatus === "retrieving" ? (
                  <div className="model-probe-wave font-mono text-[10px]" style={{ color: "#ffaa00" }}>
                    CONNECTING... RETRIEVING_MODELS
                  </div>
                ) : providerModelFetchStatus === "invalid-key" ? (
                  <div className="font-mono text-[10px] text-red-400" style={{ textShadow: "0 0 8px rgba(255, 85, 85, 0.3)" }}>
                    INVALID_KEY // AUTH_REJECTED
                  </div>
                ) : providerModelFetchStatus === "error" ? (
                  <div className="font-mono text-[10px] text-red-300" style={{ textShadow: "0 0 8px rgba(255, 122, 122, 0.3)" }}>
                    UPLINK_ERROR // RETRY
                  </div>
                ) : modelList.length === 0 ? (
                  <div className="font-mono text-[10px]" style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}>
                    NO_MODELS_LOADED
                  </div>
                ) : (
                  modelList.map((m) => {
                    const health = modelHealthByProvider[activeProvider]?.[m.id] || "idle";
                    const isSel = modelID === m.id;
                    const isFree = m.id.toLowerCase().includes("free");
                    const wave = probeInFlightByProvider[activeProvider] === m.id;
                    const modelKb = modelKeyboardHighlightId === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`${wave ? "model-probe-wave nav-row" : "nav-row"}${modelKb ? " nav-row-kb-hover" : ""}`}
                        role="button"
                        tabIndex={-1}
                        onClick={() => {
                          setProviderKeyboardHighlightId(null);
                          setModelKeyboardHighlightId(null);
                          activateModelById(m.id);
                        }}
                        style={
                          {
                            cursor: "pointer",
                            fontSize: "10px",
                            paddingTop: "4px",
                            paddingBottom: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            "--nav-color": isSel
                              ? health === "green"
                                ? "#00ff00"
                                : health === "amber"
                                  ? "#ffaa00"
                                  : inactiveTextColor
                              : isFree
                                ? "#ffaa00"
                                : inactiveSubtleTextColor,
                            "--nav-shadow": isSel
                              ? health === "green"
                                ? activeTextGlow
                                : health === "amber"
                                  ? amberTextGlow
                                  : inactiveTextGlow
                              : isFree
                                ? amberTextGlow
                                : inactiveTextGlow,
                            "--nav-hover-color": isSel ? (health === "green" ? "#36ff73" : "#ffbf4d") : "#b0b0b0",
                            "--nav-hover-shadow": isSel
                              ? health === "green"
                                ? "0 0 10px rgba(54, 255, 115, 0.30)"
                                : "0 0 10px rgba(255, 191, 77, 0.28)"
                              : inactiveTextGlow,
                          } as CSSProperties
                        }
                      >
                        {m.id.split("/").pop()}
                      </div>
                    );
                  })
                )}
              </div>

              {generatedUI ? (
                <div className="mt-4 rounded-sm border border-green-900/80 bg-black/60 p-3">
                  <div className="mb-1 font-mono text-[10px] text-green-500/90">// FEED</div>
                  <pre className="whitespace-pre-wrap font-mono text-[10px] leading-snug text-green-300/95">
                    {generatedUI}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
