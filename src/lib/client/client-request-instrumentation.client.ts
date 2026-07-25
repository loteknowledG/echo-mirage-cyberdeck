"use client";

type EndpointCounts = Map<string, number>;

let counts: EndpointCounts = new Map();
let installed = false;

function normalizeEndpoint(input: RequestInfo | URL): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.pathname
        : input.url;
  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(raw, "http://local");
    return url.pathname;
  } catch {
    return raw.split("?")[0] ?? raw;
  }
}

export function recordClientRequest(endpoint: string, delta = 1) {
  counts.set(endpoint, (counts.get(endpoint) ?? 0) + delta);
}

export function getClientRequestCounts(): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [key, value] of counts.entries()) {
    out[key] = value;
  }
  return out;
}

export function resetClientRequestCounts() {
  counts = new Map();
}

export function installClientRequestInstrumentation() {
  if (installed || typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    recordClientRequest(normalizeEndpoint(input));
    return originalFetch(input, init);
  };
  installed = true;
}
