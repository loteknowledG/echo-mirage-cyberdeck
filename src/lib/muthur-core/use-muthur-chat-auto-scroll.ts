import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

export const MUTHUR_CHAT_PIN_THRESHOLD_PX = 48;

export function isMuthurChatPinnedToBottom(
  el: HTMLElement,
  threshold = MUTHUR_CHAT_PIN_THRESHOLD_PX,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

type UseMuthurChatAutoScrollOptions = {
  scrollKey: string;
  isStreaming: boolean;
  pinnedToBottom: boolean;
  setPinnedToBottom: (pinned: boolean) => void;
  messageScrollRef: RefObject<HTMLDivElement | null>;
  scrollContentRef: RefObject<HTMLElement | null>;
};

export function useMuthurChatAutoScroll({
  scrollKey,
  isStreaming,
  pinnedToBottom,
  setPinnedToBottom,
  messageScrollRef,
  scrollContentRef,
}: UseMuthurChatAutoScrollOptions) {
  const pinnedRef = useRef(pinnedToBottom);

  useEffect(() => {
    pinnedRef.current = pinnedToBottom;
  }, [pinnedToBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    if (!pinnedRef.current) return;
    const el = messageScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, [messageScrollRef]);

  useLayoutEffect(() => {
    if (!pinnedToBottom) return;
    scrollToBottom("auto");
    if (!isStreaming) return;

    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      scrollToBottom("auto");
      innerRaf = requestAnimationFrame(() => scrollToBottom("auto"));
    });

    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
    };
  }, [scrollKey, pinnedToBottom, isStreaming, scrollToBottom]);

  useEffect(() => {
    const content = scrollContentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      scrollToBottom("auto");
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollContentRef, scrollToBottom]);

  const handleScroll = useCallback(
    (el: HTMLElement) => {
      const pinned = isMuthurChatPinnedToBottom(el);
      pinnedRef.current = pinned;
      setPinnedToBottom(pinned);
    },
    [setPinnedToBottom],
  );

  const pinToBottom = useCallback(() => {
    pinnedRef.current = true;
    setPinnedToBottom(true);
    scrollToBottom("auto");
  }, [scrollToBottom, setPinnedToBottom]);

  return { handleScroll, pinToBottom, scrollToBottom };
}
