"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import {
  bindDeckKeyboardSfx,
  playDeckNavigationSound,
  unlockDeckKeyboardSfx,
} from "@/features/cyberdeck/runtime/defer-deck-audio";
import { CYBERDECK_PROVIDER_IDS } from "@/features/cyberdeck/gateway/use-provider-connection";
import { SERVER_IDS } from "@/features/cyberdeck/workspace/custom-tab-model";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import { useCyberdeckTabStore, getCyberdeckSelectedRailTabId, type CyberdeckServerId } from "@/lib/cyberdeck-tab-store";
import { type MuthurCommandInputHandle } from "@/components/cyberdeck/muthur-command-input";

export type UseCyberdeckKeyboardNavOptions = {
  navRailContext: "gateway" | "tabs";
  setNavRailContext: (context: "gateway" | "tabs") => void;
  serverKeyboardHighlightId: (typeof SERVER_IDS)[number] | null;
  setServerKeyboardHighlightId: (id: (typeof SERVER_IDS)[number] | null) => void;
  providerKeyboardHighlightId: string | null;
  setProviderKeyboardHighlightId: (id: string | null) => void;
  modelKeyboardHighlightId: string | null;
  setModelKeyboardHighlightId: (id: string | null) => void;
  activeProvider: string;
  modelList: Array<{ id: string }>;
  messages: unknown[];
  streamText: string;
  isStreaming: boolean;
  activateModelById: (modelId: string) => void;
  handleProviderClick: (providerId: string) => void;
  pasteClipboardToOperator: () => void | Promise<void>;
  cyberdeckRootRef: RefObject<HTMLDivElement | null>;
  serverRailRef: RefObject<HTMLElement | null>;
  chatColumnRef: RefObject<HTMLDivElement | null>;
  gatewayColumnRef: RefObject<HTMLDivElement | null>;
  messageInputRef: RefObject<MuthurCommandInputHandle | null>;
  messageScrollRef: RefObject<HTMLDivElement | null>;
  serverRef: MutableRefObject<CyberdeckServerId>;
  handleTabClickRef: MutableRefObject<(id: string) => boolean>;
};

export function useCyberdeckKeyboardNav({
  navRailContext,
  setNavRailContext,
  serverKeyboardHighlightId,
  setServerKeyboardHighlightId,
  providerKeyboardHighlightId,
  setProviderKeyboardHighlightId,
  modelKeyboardHighlightId,
  setModelKeyboardHighlightId,
  activeProvider,
  modelList,
  messages,
  streamText,
  isStreaming,
  activateModelById,
  handleProviderClick,
  pasteClipboardToOperator,
  cyberdeckRootRef,
  serverRailRef,
  chatColumnRef,
  gatewayColumnRef,
  messageInputRef,
  messageScrollRef,
  serverRef,
  handleTabClickRef,
}: UseCyberdeckKeyboardNavOptions) {
  const [chatKeyboardHighlightIndex, setChatKeyboardHighlightIndex] = useState<number | null>(null);
  const deckTabNextRef = useRef<"gateway" | "rail" | "chatlog">("gateway");
  const prevNavRailRef = useRef<"gateway" | "tabs">("gateway");
  const navRailContextRef = useRef(navRailContext);
  navRailContextRef.current = navRailContext;

  useLayoutEffect(() => {
    if (navRailContext === "tabs" && prevNavRailRef.current === "gateway") {
      serverRailRef.current?.focus({ preventScroll: true });
    }
    prevNavRailRef.current = navRailContext;
  }, [navRailContext]);
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
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (e.key === "Escape" && !e.repeat) {
        emitSignal({ source: "ui", type: "cancel", payload: { via: "escape" }, severity: "info" });
      }

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
      const inChatInput =
        messageInputRef.current?.element != null && t === messageInputRef.current.element;
      const isEditableTarget =
        t.isContentEditable ||
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT";

      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "v" || e.key === "V")) {
        if (isEditableTarget) return;
        if (useCyberdeckTabStore.getState().server === "m") {
          e.preventDefault();
          void pasteClipboardToOperator();
          return;
        }
      }

      const sfxNav = {
        step: () => {
          if (!e.repeat) playDeckNavigationSound("step");
        },
        commit: () => {
          if (!e.repeat) playDeckNavigationSound("commit");
        },
        back: () => {
          if (!e.repeat) playDeckNavigationSound("back");
        },
      };

      // Tab: message box ↔ deck columns/surfaces; includes chat log (col2) in sequencer.
      if (e.key === "Tab" && !e.repeat) {
        const msg = messageInputRef.current?.element;
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
        } else if (inChatCol && !inChatInput) {
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
              messageScrollRef.current?.focus({ preventScroll: true });
              deckTabNextRef.current = "chatlog";
            } else if (next === "rail") {
              gatewayColumnRef.current?.focus({ preventScroll: true });
              deckTabNextRef.current = "gateway";
            } else {
              serverRailRef.current?.focus({ preventScroll: true });
              setNavRailContext("tabs");
              setServerKeyboardHighlightId(serverRef.current);
              deckTabNextRef.current = "rail";
            }
            return;
          }
          if (next === "gateway") {
            gatewayColumnRef.current?.focus({ preventScroll: true });
            deckTabNextRef.current = "rail";
          } else if (next === "rail") {
            serverRailRef.current?.focus({ preventScroll: true });
            setNavRailContext("tabs");
            setServerKeyboardHighlightId(serverRef.current);
            deckTabNextRef.current = "chatlog";
          } else {
            messageScrollRef.current?.focus({ preventScroll: true });
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
          setServerKeyboardHighlightId(serverRef.current);
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
          const sids: (typeof SERVER_IDS)[number][] = [...SERVER_IDS];
          const sPivot =
            serverKeyboardHighlightId ??
            ((SERVER_IDS as readonly string[]).includes(getCyberdeckSelectedRailTabId())
              ? (getCyberdeckSelectedRailTabId() as (typeof SERVER_IDS)[number])
              : sids[0]);
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
            const tabChanged = handleTabClickRef.current(serverKeyboardHighlightId ?? sPivot);
            if (tabChanged) {
              setNavRailContext("gateway");
              setServerKeyboardHighlightId(null);
              setModelKeyboardHighlightId(null);
              const pid =
                (CYBERDECK_PROVIDER_IDS as readonly string[]).includes(activeProvider) ? activeProvider : CYBERDECK_PROVIDER_IDS[0];
              setProviderKeyboardHighlightId(pid);
            }
            return;
          }
        } else if (navKey && !isEditableTarget) {
          e.preventDefault();
        }
        if (!isEditableTarget) return;
      }

      if (inChatCol && !inChatInput) {
        const chatRowCount =
          messages.length + (streamText ? 1 : 0) + (isStreaming && !streamText ? 1 : 0);
        if (chatRowCount > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex((prev) => {
              const current = prev == null ? -1 : Math.min(prev, chatRowCount - 1);
              return Math.min(current + 1, chatRowCount - 1);
            });
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex((prev) => {
              const current = prev == null ? chatRowCount : Math.min(prev, chatRowCount - 1);
              return Math.max(current - 1, 0);
            });
            return;
          }
          if (e.key === "Home") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex(0);
            return;
          }
          if (e.key === "End") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex(chatRowCount - 1);
            return;
          }
        }
      }

      const allowGatewayKeys =
        navRailContext === "gateway" && (inGateway || (!inChatCol && !inRail));

      if (!allowGatewayKeys) return;

      // Pi composer and gateway key fields handle Enter/arrows locally.
      if (isEditableTarget) return;

      const ids = [...CYBERDECK_PROVIDER_IDS];
      const pivot =
        providerKeyboardHighlightId ??
        (ids.includes(activeProvider as (typeof CYBERDECK_PROVIDER_IDS)[number]) ? activeProvider : ids[0]);
      let idx = ids.indexOf(pivot as (typeof CYBERDECK_PROVIDER_IDS)[number]);
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
        handleProviderClick(providerKeyboardHighlightId);
        setProviderKeyboardHighlightId(null);
        setModelKeyboardHighlightId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    activateModelById,
    activeProvider,
    modelKeyboardHighlightId,
    modelList,
    navRailContext,
    providerKeyboardHighlightId,
    handleProviderClick,
    pasteClipboardToOperator,
    serverKeyboardHighlightId,
  ]);
  useEffect(() => {
    const maxIndex = messages.length + (streamText ? 1 : 0) + (isStreaming && !streamText ? 1 : 0) - 1;
    setChatKeyboardHighlightIndex((prev) => {
      if (prev == null) return null;
      if (maxIndex < 0) return null;
      return Math.min(prev, maxIndex);
    });
  }, [isStreaming, messages.length, streamText]);
  useEffect(() => {
    if (chatKeyboardHighlightIndex == null) return;
    window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-chat-row="${chatKeyboardHighlightIndex}"]`);
      row?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    });
  }, [chatKeyboardHighlightIndex]);
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
    const scrollToHighlight = (selector: string) => {
      window.requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(selector);
        el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      });
    };

    if (navRailContext === "tabs" && serverKeyboardHighlightId) {
      scrollToHighlight(`[data-server-tab="${serverKeyboardHighlightId}"]`);
    }
  }, [navRailContext, serverKeyboardHighlightId]);
  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      void unlockDeckKeyboardSfx();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });

    const unbind = bindDeckKeyboardSfx(window, {
      mode: "cyberdeck",
      volume: 1.25,
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      unbind();
    };
  }, []);
  return { chatKeyboardHighlightIndex, setChatKeyboardHighlightIndex };
}
