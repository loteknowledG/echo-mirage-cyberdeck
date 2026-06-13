export const OPERATOR_BROWSER_HOME_URL = "https://duckduckgo.com/";

/** Windows, UNC, or Unix absolute path (single segment or full path). */
export function looksLikeLocalPath(value: string): boolean {
  const trimmed = value.trim();
  return /^[a-zA-Z]:[\\/]/.test(trimmed) || /^\\\\/.test(trimmed) || /^\//.test(trimmed);
}

/** True when the operator message points at disk, not the web. */
export function messageReferencesLocalPath(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[a-zA-Z]:[\\/]/.test(trimmed)) return true;
  if (/(?:^|\s)\\\\[^\s]+/.test(trimmed)) return true;
  if (/(?:^|\s)\/(?:[\w.-]+\/)+[\w.-]+/.test(trimmed)) return true;
  return false;
}

const KNOWN_CAR_MAKES = [
  "acura",
  "audi",
  "bmw",
  "buick",
  "cadillac",
  "chevrolet",
  "chevy",
  "chrysler",
  "dodge",
  "fiat",
  "ford",
  "genesis",
  "gmc",
  "honda",
  "hyundai",
  "infiniti",
  "jaguar",
  "jeep",
  "kia",
  "land rover",
  "lexus",
  "lincoln",
  "mazda",
  "mercedes",
  "mercedes-benz",
  "mini",
  "mitsubishi",
  "nissan",
  "ram",
  "subaru",
  "tesla",
  "toyota",
  "volkswagen",
  "volvo",
] as const;

export type BrowserCommand =
  | { kind: "goto"; url: string }
  | { kind: "click"; selector: string }
  | { kind: "type"; selector: string; value: string }
  | { kind: "submit"; selector: string }
  | { kind: "snapshot" }
  | { kind: "back" }
  | { kind: "forward" }
  | { kind: "reload" };

export function normalizeOperatorBrowserUrl(raw: string) {
  const value = raw.trim();
  if (!value) return OPERATOR_BROWSER_HOME_URL;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) return rewriteSearchEngineUrl(value);
  if (/^(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/.*)?$/i.test(value)) {
    return `http://${value.replace(/^https?:\/\//i, "")}`;
  }
  if (/^[^\s]+\.[^\s/]+(?:\/.*)?$/i.test(value)) return rewriteSearchEngineUrl(`https://${value}`);
  if (/\bdot\b/i.test(value)) {
    const dotWordCandidate = value
      .replace(/\s+dot\s+/gi, ".")
      .replace(/\s+/g, ".");
    if (/^[^\s]+\.[^\s/]+(?:\/.*)?$/i.test(dotWordCandidate)) {
      return rewriteSearchEngineUrl(`https://${dotWordCandidate}`);
    }
  }
  return `${OPERATOR_BROWSER_HOME_URL}?q=${encodeURIComponent(value)}`;
}

function rewriteSearchEngineUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.endsWith("bing.com") && parsed.pathname.toLowerCase() === "/search") {
      const query = parsed.searchParams.get("q")?.trim();
      if (query) {
        return `${OPERATOR_BROWSER_HOME_URL}?q=${encodeURIComponent(query)}`;
      }
    }
  } catch {
    /* ignore */
  }

  return url;
}

export function deriveOperatorBrowserUrl(intent: string) {
  const text = intent.trim();
  if (!text) return OPERATOR_BROWSER_HOME_URL;

  const inBrowserMatch = text.match(/^(?:in|on)\s+(?:the\s+)?browser\s+(.*)$/i);
  if (inBrowserMatch) {
    return deriveOperatorBrowserUrl(inBrowserMatch[1] || "");
  }

  const explicitMatch = text.match(/^(?:\/web|web:)\s*(.*)$/i);
  if (explicitMatch) {
    return normalizeOperatorBrowserUrl(explicitMatch[1] || "");
  }

  const phraseMatch = text.match(
    /^(?:use the web(?: to)?(?: find| search| look up)?|browse(?: the)? web(?: for)?|search(?: the)? web(?: for)?|open(?: the)? browser(?: to)?|go to|got to)\s*(.*)$/i,
  );
  if (phraseMatch) {
    return normalizeOperatorBrowserUrl(phraseMatch[1] || text);
  }

  return normalizeOperatorBrowserUrl(text);
}

export function stripMuthurInvocationPrefix(intent: string) {
  const text = intent.trim();
  if (!text) return "";

  const stripped = text.replace(
    /^(?:muthur|mother|mu\/thur|mu-thur|mu_thur)(?:[:,]|\s+\S+[:,]?)?\s+/i,
    "",
  );
  return stripped.trim() || text;
}

export function stripBrowserSearchPrefix(intent: string) {
  const text = intent.trim();
  if (!text) return "";

  const webPrefixMatch = text.match(
    /^(?:find|search|look for|look up|show me|show|help me find|help me search for|can you find|can you search for)\s+(?:the\s+)?web(?:\s+for)?\s+(.+)$/i,
  );
  if (webPrefixMatch) {
    return webPrefixMatch[1].trim();
  }

  const prefixMatch = text.match(
    /^(?:find|search|look for|look up|show me|show|help me find|help me search for|can you find|can you search for)\s+(?:what\s+)?(.+)$/i,
  );
  if (prefixMatch) {
    return prefixMatch[1].trim();
  }

  return text;
}

export function deriveCarsComSearchUrl(intent: string) {
  const text = stripBrowserSearchPrefix(intent).toLowerCase().replace(/[^\w\s-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const searchTerms = new Set<string>();

  const locationMatch = text.match(
    /\b(?:in|near|around|at)\s+([a-z0-9][a-z0-9\s.-]*?)(?:\s+(?:for sale|on sale|available|in stock|today|now))?$/i,
  );
  const location = locationMatch?.[1]?.trim() || "";
  const searchText = locationMatch ? text.slice(0, locationMatch.index).trim() : text;
  const isGenericCarSearch =
    /\b(?:car|cars|vehicle|vehicles|auto|autos)\b/i.test(searchText) &&
    !/\b(?:used|new|for sale|on sale|available|in stock)\b/i.test(searchText);

  let make = "";
  let model = "";
  let makeIndex = -1;

  for (const candidate of KNOWN_CAR_MAKES) {
    const candidateIndex = searchText.indexOf(candidate);
    if (candidateIndex === -1) continue;
    if (makeIndex === -1 || candidateIndex < makeIndex) {
      make = candidate;
      makeIndex = candidateIndex;
    }
  }

  if (makeIndex === -1) {
    if (!isGenericCarSearch) return null;
    searchTerms.add("cars for sale");
    if (location) searchTerms.add(location);
    const query = Array.from(searchTerms).join(" ").trim();
    return `${OPERATOR_BROWSER_HOME_URL}?q=${encodeURIComponent(query)}`;
  }

  searchTerms.add(make);

  const afterMake = searchText.slice(makeIndex + make.length).trim();
  const modelMatch = afterMake.match(/^([a-z0-9][a-z0-9\s-]*?)(?:\s+(?:for sale|on sale|available|in stock|used|new))?$/i);
  if (!modelMatch) return null;
  model = modelMatch[1].trim();
  if (!model) return null;

  searchTerms.add(model);
  searchTerms.add("for sale");
  if (location) searchTerms.add(location);

  const query = Array.from(searchTerms).join(" ").trim();
  return `${OPERATOR_BROWSER_HOME_URL}?q=${encodeURIComponent(query)}`;
}

export function deriveJobsSearchUrl(intent: string) {
  const text = stripBrowserSearchPrefix(intent).toLowerCase().replace(/[^\w\s-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const looksLikeJobSearch =
    /\b(?:job|jobs|career|careers|role|roles|position|positions|employment|hiring|openings)\b/i.test(text) ||
    /\bremote\b/i.test(text);
  if (!looksLikeJobSearch) return null;

  const query = text
    .replace(/\b(?:find|search|look for|look up|show me|show|help me find|help me search for|can you find|can you search for)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!query) return null;
  return `${OPERATOR_BROWSER_HOME_URL}?q=${encodeURIComponent(query)}`;
}

export function looksLikeCaptchaBlock(snapshotText: string) {
  const text = snapshotText.trim().toLowerCase();
  if (!text) return false;
  return (
    /\bcaptcha\b/.test(text) ||
    /\byou have been blocked\b/.test(text) ||
    /\baccess is denied\b/.test(text) ||
    /\battention required\b/.test(text) ||
    /\bcloudflare\b/.test(text) ||
    /\bverify you are human\b/.test(text) ||
    /\bbot challenge\b/.test(text) ||
    /\bselect all squares containing\b/.test(text) ||
    /\bconfirm this search was made by a human\b/.test(text) ||
    /\bpress and hold\b/.test(text)
  );
}

const LOCAL_OPERATOR_KEYWORDS = [
  "operator pane",
  "the operator pane",
  "editor pane",
  "the editor pane",
  "monaco",
  "current editor",
  "active document",
  "current file",
  "what's open",
  "what are you looking at",
  "what do you see here",
  "what is in this pane",
  "whats in the operator",
  "what's in the operator",
  "whats on the operator",
  "what's on the operator",
  "read the active document",
  "summarize the current editor",
  "can you see the current file",
  "what is open in the editor",
];

function containsLocalOperatorKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  const hasLocalKw = LOCAL_OPERATOR_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasLocalKw) return false;
  const hasExplicitWebSearch = /^(?:search\s+the\s+web|use\s+the\s+web|browse\s+the\s+web|google|duckduckgo)/i.test(text);
  return !hasExplicitWebSearch;
}

export function looksLikeOperatorWebIntent(intent: string) {
  const text = intent.trim().toLowerCase();
  if (!text) return false;
  if (messageReferencesLocalPath(intent)) return false;
  if (containsLocalOperatorKeyword(text)) return false;
  return (
    /^(?:\/web|web:)\b/i.test(text) ||
    /\b(?:use the web|browse the web|search the web|open the browser|go to the web|in the browser|on the browser)\b/i.test(text) ||
    /\b(?:for sale|on sale|available|in stock|dealership|dealer|inventory|used car|used cars|new car|new cars|car lot|auto lot)\b/i.test(
      text,
    )
  );
}

export function looksLikeBrowserSearchOffer(text: string) {
  const value = text.trim().toLowerCase();
  if (!value) return false;
  return (
    /\b(?:want me to|shall i|should i|i can|i'll|let me)\s+(?:open|start|use)?\s*(?:a\s+)?(?:browser|search|look it up|look that up|search for it|search the web)\b/i.test(
      value,
    ) ||
    /\b(?:open a browser and search|search for it|look it up|look that up|want me to search)\b/i.test(value)
  );
}

export function looksLikeAffirmativeReply(text: string) {
  const value = text.trim().toLowerCase();
  if (!value) return false;
  return /^(?:yes|yeah|yep|sure|ok|okay|please|go ahead|do it|open browser|search it|search for it|look it up)(?:[.!?]*)$/i.test(
    value,
  );
}

export function parseBrowserCommand(input: string): BrowserCommand | null {
  const text = input.trim();
  if (!text) return null;
  if (messageReferencesLocalPath(text)) return null;
  const commandText = stripMuthurInvocationPrefix(text);

  if (containsLocalOperatorKeyword(commandText)) return null;

  const commandMatch = commandText.match(/^(?:\/browser|browser:|\/web|web:)\s*(.+)$/i);
  const body = (commandMatch?.[1] || commandText).trim();
  const lower = body.toLowerCase();

  if (/^(?:back|go back)$/i.test(lower)) return { kind: "back" };
  if (/^(?:forward|go forward)$/i.test(lower)) return { kind: "forward" };
  if (/^(?:reload|refresh)$/i.test(lower)) return { kind: "reload" };
  if (/^(?:snapshot|capture|inspect)$/i.test(lower)) return { kind: "snapshot" };

  if (/^(?:click|press|tap)\s+(?:the\s+)?(?:first|1st)\s+(?:result|item|listing|link|match)$/i.test(body)) {
    return { kind: "click", selector: "a[href], button" };
  }

  const gotoMatch = body.match(/^(?:goto|go to|got to|open|navigate)\s+(.+)$/i);
  if (gotoMatch) {
    return { kind: "goto", url: gotoMatch[1].trim() };
  }
  const inBrowserGotoMatch = body.match(
    /^(?:in|on)\s+(?:the\s+)?browser\s+(?:goto|go to|got to|open|navigate)\s+(.+)$/i,
  );
  if (inBrowserGotoMatch) {
    return { kind: "goto", url: inBrowserGotoMatch[1].trim() };
  }

  const clickMatch = body.match(/^(?:click|press|tap)\s+(.+)$/i);
  if (clickMatch) {
    return { kind: "click", selector: clickMatch[1].trim() };
  }

  const typeMatch = body.match(/^(?:type|enter|fill)\s+(.+?)(?:\s+(?:with|into|=|:)\s+(.+))$/i);
  if (typeMatch) {
    return { kind: "type", selector: typeMatch[1].trim(), value: typeMatch[2].trim() };
  }

  const submitMatch = body.match(/^(?:submit|send)\s+(.+)$/i);
  if (submitMatch) {
    return { kind: "submit", selector: submitMatch[1].trim() };
  }

  const shoppingIntent =
    /^(?:find|search|look for|look up|show me|show)\b/i.test(body) ||
    /\b(?:for sale|on sale|available|in stock|dealership|dealer|inventory|used car|used cars|new car|new cars|car lot|auto lot|near me|nearby)\b/i.test(
      body,
    );
  if (shoppingIntent) {
    return {
      kind: "goto",
      url:
        deriveCarsComSearchUrl(body) ||
        deriveJobsSearchUrl(body) ||
        deriveOperatorBrowserUrl(stripBrowserSearchPrefix(body)),
    };
  }

  if (looksLikeOperatorWebIntent(commandText)) {
    return { kind: "goto", url: deriveOperatorBrowserUrl(stripBrowserSearchPrefix(commandText)) };
  }

  return null;
}

export function parseBrowserUseModeCommand(input: string): BrowserCommand | null {
  const text = stripMuthurInvocationPrefix(input).trim();
  if (!text) return null;
  if (messageReferencesLocalPath(text)) return null;
  if (containsLocalOperatorKeyword(text)) return null;

  const parsed = parseBrowserCommand(text);
  if (parsed) return parsed;

  if (/^(?:https?:\/\/|localhost|127\.0\.0\.1)(?::\d+)?(?:\/.*)?$/i.test(text)) {
    return { kind: "goto", url: text };
  }

  if (/^[^\s]+\.[^\s/]+(?:\/.*)?$/i.test(text)) {
    return { kind: "goto", url: text };
  }

  return null;
}

function stripAssistantDirectiveMarkup(text: string) {
  return text
    .trim()
    .replace(/^```[a-z0-9_-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractAssistantBrowserCommand(text: string): BrowserCommand | null {
  const cleaned = stripAssistantDirectiveMarkup(text);
  if (!cleaned) return null;
  if (messageReferencesLocalPath(cleaned)) return null;
  if (containsLocalOperatorKeyword(cleaned)) return null;

  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const directiveLine = lines[0] || cleaned;

  const directiveMatch = directiveLine.match(
    /^(?:navigate|go to|goto|open(?: the)? browser(?: and search)?|search the web for)\s*(?:[:=]\s*|\s+)(.+)$/i,
  );
  if (!directiveMatch?.[1]) return null;

  const target = directiveMatch[1].trim();
  if (!target) return null;

  return { kind: "goto", url: rewriteSearchEngineUrl(normalizeOperatorBrowserUrl(target)) };
}
