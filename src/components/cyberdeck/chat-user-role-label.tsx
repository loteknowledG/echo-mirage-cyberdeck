"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CHAT_USER_DISPLAY_NAME,
  normalizeChatUserDisplayName,
} from "@/lib/chat-user-display-name";

type ChatUserRoleLabelProps = {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
};

export function ChatUserRoleLabel({ displayName, onDisplayNameChange }: ChatUserRoleLabelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);

  useEffect(() => {
    if (!editing) setDraft(displayName);
  }, [displayName, editing]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, [editing]);

  const commit = useCallback(() => {
    const next = normalizeChatUserDisplayName(draft);
    onDisplayNameChange(next);
    setDraft(next);
    setEditing(false);
  }, [draft, onDisplayNameChange]);

  const cancel = useCallback(() => {
    setDraft(displayName);
    setEditing(false);
  }, [displayName]);

  if (editing) {
    return (
      <span className="inline-flex items-center text-gray-600">
        [
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          onBlur={commit}
          maxLength={16}
          spellCheck={false}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Your chat display name"
          className="mx-0.5 w-[5.5rem] border-b border-green-600/70 bg-transparent px-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-gray-300 outline-none"
        />
        ]{" "}
      </span>
    );
  }

  const label = displayName || DEFAULT_CHAT_USER_DISPLAY_NAME;

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(label);
        setEditing(true);
      }}
      title="Click to set your chat name"
      className="cursor-pointer text-gray-600 transition-colors hover:text-green-300 hover:underline"
    >
      [{label}]{" "}
    </button>
  );
}
