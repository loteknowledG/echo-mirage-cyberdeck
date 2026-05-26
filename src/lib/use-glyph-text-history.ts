"use client";

import { useCallback, useRef, useState } from "react";

const DEFAULT_LIMIT = 50;
const EDIT_DEBOUNCE_MS = 450;

export type GlyphTextHistoryApi = {
  text: string;
  canUndo: boolean;
  canRedo: boolean;
  setText: (next: string, mode?: "immediate" | "debounced" | "skip") => void;
  undo: () => string | null;
  redo: () => string | null;
  reset: (next: string) => void;
};

export function useGlyphTextHistory(initial: string, limit = DEFAULT_LIMIT): GlyphTextHistoryApi {
  const [text, setTextState] = useState(initial);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const textRef = useRef(initial);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const skipRef = useRef(false);
  const editBaseRef = useRef<string | null>(null);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushPast = useCallback(
    (snapshot: string) => {
      const trimmed = pastRef.current;
      if (trimmed.length > 0 && trimmed[trimmed.length - 1] === snapshot) return;
      const nextPast = [...trimmed, snapshot].slice(-limit);
      setPast(nextPast);
      pastRef.current = nextPast;
      setFuture([]);
      futureRef.current = [];
    },
    [limit],
  );

  const commitPast = useCallback(() => {
    if (editBaseRef.current == null) return;
    const base = editBaseRef.current;
    editBaseRef.current = null;
    if (base !== textRef.current) pushPast(base);
  }, [pushPast]);

  const setText = useCallback(
    (next: string, mode: "immediate" | "debounced" | "skip" = "immediate") => {
      if (skipRef.current || mode === "skip") {
        setTextState(next);
        textRef.current = next;
        return;
      }

      if (mode === "debounced") {
        if (editBaseRef.current == null) editBaseRef.current = textRef.current;
        setTextState(next);
        textRef.current = next;
        if (editTimerRef.current) clearTimeout(editTimerRef.current);
        editTimerRef.current = setTimeout(() => {
          commitPast();
        }, EDIT_DEBOUNCE_MS);
        return;
      }

      if (editTimerRef.current) {
        clearTimeout(editTimerRef.current);
        editTimerRef.current = null;
      }
      commitPast();
      if (next !== textRef.current) pushPast(textRef.current);
      setTextState(next);
      textRef.current = next;
    },
    [commitPast, pushPast],
  );

  const undo = useCallback((): string | null => {
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
    if (editBaseRef.current != null) {
      const base = editBaseRef.current;
      editBaseRef.current = null;
      if (base !== textRef.current) pushPast(base);
    }
    const stack = pastRef.current;
    if (stack.length === 0) return null;
    const previous = stack[stack.length - 1]!;
    const nextPast = stack.slice(0, -1);
    const nextFuture = [textRef.current, ...futureRef.current].slice(0, limit);
    skipRef.current = true;
    setTextState(previous);
    textRef.current = previous;
    setPast(nextPast);
    setFuture(nextFuture);
    pastRef.current = nextPast;
    futureRef.current = nextFuture;
    skipRef.current = false;
    return previous;
  }, [limit, pushPast]);

  const redo = useCallback((): string | null => {
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
    if (editBaseRef.current != null) {
      const base = editBaseRef.current;
      editBaseRef.current = null;
      if (base !== textRef.current) pushPast(base);
    }
    const stack = futureRef.current;
    if (stack.length === 0) return null;
    const next = stack[0]!;
    const nextFuture = stack.slice(1);
    const nextPast = [...pastRef.current, textRef.current].slice(-limit);
    skipRef.current = true;
    setTextState(next);
    textRef.current = next;
    setPast(nextPast);
    setFuture(nextFuture);
    pastRef.current = nextPast;
    futureRef.current = nextFuture;
    skipRef.current = false;
    return next;
  }, [limit, pushPast]);

  const reset = useCallback(
    (next: string) => {
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
      editBaseRef.current = null;
      skipRef.current = true;
      setTextState(next);
      setPast([]);
      setFuture([]);
      textRef.current = next;
      pastRef.current = [];
      futureRef.current = [];
      skipRef.current = false;
    },
    [],
  );

  return {
    text,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    setText,
    undo,
    redo,
    reset,
  };
}
