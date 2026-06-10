export function persistMuthurShipMemoryTurn(user: string, assistant: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    op: "record_turn",
    user: user.slice(0, 500),
    assistant: assistant.slice(0, 2000),
  };

  void fetch("/api/muthur/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* ship memory is best-effort */
  });
}
