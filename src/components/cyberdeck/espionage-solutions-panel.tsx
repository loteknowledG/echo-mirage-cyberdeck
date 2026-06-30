"use client";

import { useEffect, useRef } from "react";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MIRAGE_DISPLAY,
} from "@/lib/cyberdeck/espionage-mode";
import { useEspionageChatMessages, type EspionageChatMessage } from "@/lib/cyberdeck/espionage-chat";

function roleLabel(role: EspionageChatMessage["role"]): string {
  switch (role) {
    case "assistant":
      return "MUTHUR";
    case "user":
      return "MISSION";
    default:
      return "SYS";
  }
}

function roleClass(role: EspionageChatMessage["role"]): string {
  switch (role) {
    case "assistant":
      return "text-emerald-200/90";
    case "user":
      return "text-fuchsia-200/80";
    default:
      return "text-cyan-200/80";
  }
}

export function EspionageSolutionsPanel() {
  const messages = useEspionageChatMessages();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  return (
    <section className="flex min-h-[220px] flex-col rounded border border-[#1c1c1c] bg-black/60">
      <header className="border-b border-[#1c1c1c] px-3 py-2">
        <p className="text-[9px] tracking-[0.12em] text-fuchsia-300/90">
          {ESPIONAGE_MIRAGE_DISPLAY} SOLUTIONS
        </p>
        <p className="mt-1 text-[8px] leading-relaxed text-[#5f5f5f]">
          Linked with {ESPIONAGE_ECHO_DISPLAY}. Answers from capture missions stream here and in the
          MUTHUR chat column.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 ? (
          <p className="text-[9px] text-[#6a6a6a]">
            Waiting for link confirmation and PowerFist missions…
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="font-mono text-[10px] leading-relaxed">
              <span className={`mr-2 text-[8px] tracking-[0.1em] ${roleClass(message.role)}`}>
                [{roleLabel(message.role)}]
              </span>
              <span className="whitespace-pre-wrap text-[#bdbdbd]">{message.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
