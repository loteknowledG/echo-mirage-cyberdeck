const HELP_TOPICS = [
  "overview",
  "gateway",
  "muthur",
  "docs",
  "tabs",
  "glyph",
  "browser",
  "computer",
  "chat",
] as const;

export type MuthurHelpTopic = (typeof HELP_TOPICS)[number];

const TOPIC_ALIASES: Record<string, MuthurHelpTopic> = {
  overview: "overview",
  help: "overview",
  commands: "overview",
  list: "overview",
  gateway: "gateway",
  uplink: "gateway",
  provider: "gateway",
  providers: "gateway",
  muthur: "muthur",
  operator: "muthur",
  docs: "docs",
  document: "docs",
  export: "docs",
  convert: "docs",
  import: "docs",
  tabs: "tabs",
  tab: "tabs",
  glyph: "glyph",
  ascii: "glyph",
  figlet: "glyph",
  browser: "browser",
  web: "browser",
  computer: "computer",
  deck: "computer",
  cardtable: "computer",
  "card-table": "computer",
  observe: "computer",
  chat: "chat",
  natural: "chat",
};

export type MuthurHelpIntent =
  | { kind: "topic"; topic: MuthurHelpTopic }
  | { kind: "unknown"; topic: string };

export function parseMuthurClearChatIntent(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return /^(?:\/muthur\s+clear|muthur\s+clear|clear\s+(?:chat|muthur)|\/clear|clear)$/i.test(
    trimmed,
  );
}

export function parseMuthurHelpIntent(input: string): MuthurHelpIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(?:\/muthur\s+help|muthur\s+help|\/help|help)(?:\s+([\w-]+))?$/i,
  );
  if (!match) return null;

  const raw = (match[1] || "overview").toLowerCase();
  const topic = TOPIC_ALIASES[raw];
  if (topic) return { kind: "topic", topic };
  return { kind: "unknown", topic: raw };
}

export function muthurHelpTopicIds(): readonly string[] {
  return HELP_TOPICS;
}

const SECTIONS: Record<MuthurHelpTopic, string> = {
  overview: `[MUTHUR HELP // COMMAND INDEX]

Type:  help  or  muthur help  or  /muthur help
Topics:  muthur help <topic>

Topics:
  gateway   — providers, models, settings, API keys
  muthur    — review, read, history, status
  docs      — import PDF/DOCX, export DOCX/PDF
  tabs      — create, rename, convert, close rail tabs
  glyph     — ASCII / FIGlet glyph channel
  browser   — web pane navigation & search
  computer  — observe workflow, card table, indicate
  chat      — natural language uplink (default)

Full reference: docs/muthur-commands.md`,

  gateway: `[MUTHUR HELP // GATEWAY]

providers · models · status · connection status
settings · /settings
(paste API key in $ input when unauthenticated)`,

  muthur: `[MUTHUR HELP // MUTHUR OPERATOR]

/muthur review          — git diff code review
/muthur read <path>     — read file into chat
/muthur history         — recent git log
/muthur status          — uplink + provider snapshot
clear · muthur clear    — wipe MUTHUR chat log
/muthur help [topic]    — this help`,

  docs: `[MUTHUR HELP // DOCUMENTS]

Import (PDF/DOCX → markdown):
  muthur md <path>
  muthur convert <path> to markdown

Export operator document:
  export to docx · export to pdf
  muthur export to docx · muthur export to pdf

Export file by path:
  muthur docx <file.md> · muthur pdf <file.md>
  muthur export <file.md> to docx|pdf`,

  tabs: `[MUTHUR HELP // CUSTOM TABS]

Optional prefix: /tab  or  tab:

new tab · create tab [named LABEL] [glyph X]
rename tab to LABEL
convert tab to <kind>
clear tab · reset tab state
delete tab · close tab

Kinds: document, web, settings, voice-lab, glyph-channel,
memory-atlas, flight-log, diagnostics, pi, catalog, operators,
rola-dex, sound-profile, connection, blank`,

  glyph: `[MUTHUR HELP // GLYPH / ASCII]

MUTHUR co-creates art via the ASCII skill — intent + template, not hand-spaced art.

ascii.render JSON (in \`\`\`ascii-render fence):
  template: hud_box | sonar_title | boot_panel | warning_panel |
            operator_status | route_verify_report
  style: weyland | muthur | echo_mirage | retro_terminal | alarm | stealth

glyph mode · glyph off · glyph clear · glyph copy
glyph edit · glyph view
figlet <text> · figlet --font Impossible <text>
ascii render { ...json... }

Legacy: [GLYPH:engine=figlet text="…" font=Impossible merge=append]`,

  browser: `[MUTHUR HELP // BROWSER]

Prefix: /web · web: · /browser · browser:

go to <url> · open <url> · navigate <url>
back · forward · reload
snapshot · capture
click <selector> · type <sel> with <text> · submit <sel>
search … · find … · go to the web …

Browser pane active: bare URLs also navigate.
Reply yes / ok / go ahead after MUTHUR offers a search.`,

  computer: `[MUTHUR HELP // COMPUTER USE & CARD TABLE]

Capabilities: what can you do · computer use status
Screen: inspect screen · what's on my screen
Observe: start workflow observation · pause · resume · stop
Card table: show deck · prepare reviewer hand · describe my hand
           push hand to stack · clear deck · execute deck
Pointer: indicate … · highlight … · clear indicators
Teaching: muthur, start teaching demo

During observation: yes · no · skip · record this · recovery`,

  chat: `[MUTHUR HELP // NATURAL LANGUAGE UPLINK]

Any message not matched as a local command is sent to the
active provider model (OpenCode / OpenRouter / OpenAI).

clear · clear chat · muthur clear  — wipe chat log (local)

Memory context from MUTHUR memory is attached automatically.
Browser snapshot included when browser pane is active.

Examples:
  explain the repo structure
  summarize the last assistant reply
  what does this error mean?`,
};

export function getMuthurHelpText(topic: MuthurHelpTopic): string {
  return SECTIONS[topic];
}

export function getMuthurHelpUnknownTopicText(topic: string): string {
  return `[MUTHUR HELP // UNKNOWN TOPIC "${topic}"]

Known topics: ${HELP_TOPICS.join(", ")}

Try:  muthur help overview`;
}
