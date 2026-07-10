import {
  buildLocalFsActionParamDescription,
  buildLocalFsPathParamDescription,
  buildLocalFsWriteScopeDescription,
} from "@/lib/muthur/execution/localfs-write-scope.server";
import { isMuthurDirectPiComputerUseEnabled } from "@/lib/muthur/control/muthur-direct-pi-computer-use";
import { isCalyxMuthurToolsEnabled } from "@/lib/muthur/calyx/calyx-muthur-tools.server";
import { isSamusHandsEyesEnabled } from "@/lib/samus-manus/samus-manus-config.server";
import { SAMUS_HANDS_EYES_ACTIONS } from "@/lib/samus-manus/hands-eyes.server";
import type { MuthurPosture, MuthurPostureToolContext } from "@/lib/muthur/muthur-posture";
import { isToolAllowedForPosture } from "@/lib/muthur/muthur-posture";

function buildLocalFsToolDescription(): string {
  return (
    `Filesystem on the machine running the Next dev server. ls, cat, stat on any readable path. ${buildLocalFsWriteScopeDescription()} ` +
    "Prefer localfs write for creating/updating source files."
  );
}

/**
 * OpenAI-compatible `tools` for chat/completions.
 * @see https://platform.openai.com/docs/guides/function-calling
 */
export const MUTHUR_OPENAI_TOOLS: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}> = [
  {
    type: "function",
    function: {
      name: "observe_operator_pane",
      description:
        "Read the latest visible operational state from the Echo Mirage operator surface. This is observation only: it cannot click, edit, dispatch, deploy, or execute actions.",
      parameters: {
        type: "object",
        properties: {
          surface: {
            type: "string",
            enum: ["cyberdeck", "property-manager"],
            description: "Optional visible surface to observe. Omit for the most recently visible surface.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_operator_file",
      description:
        "Open a text/markdown/code file from the Echo Mirage workspace in the operator Monaco editor on the operator's screen. Call this before suggest_operator_edit when no file is open in the operator pane. Not for DOCX/PDF — convert DOCX first.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Absolute or repo-relative path to a Monaco-editable file (.md, .ts, .tsx, .json, etc.).",
          },
          mode: {
            type: "string",
            enum: ["edit", "view"],
            description: "Optional. Defaults to edit.",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_operator_edit",
        description:
          "Propose a typed edit to the markdown/code/text file open in the operator Monaco editor. Applies immediately in the operator pane (Ctrl+Z to undo; save when ready). Call open_operator_file (or observe_operator_pane) first. Not for DOCX/PDF/image previews. Prefer replace_line_range for surgical edits; replace_content only when rewriting the whole file.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "replace_content",
              "replace_line_range",
              "insert_at_cursor",
              "append_section",
              "replace_selection",
            ],
            description: "How to apply the edit in the active Monaco editor.",
          },
          text: {
            type: "string",
            description: "Replacement or inserted UTF-8 text.",
          },
          startLine: {
            type: "integer",
            description: "replace_line_range only: first line to replace (1-based, inclusive).",
          },
          endLine: {
            type: "integer",
            description: "replace_line_range only: last line to replace (1-based, inclusive).",
          },
        },
        required: ["kind", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workspace_exec",
      description:
        "Run an allowlisted shell command on the REAL Echo Mirage workspace disk (changes persist). Allowed: pnpm exec tsc --noEmit, pnpm lint, pnpm build, pnpm e2e, git diff, git diff --stat, git status --short, git log --oneline -10. Use after code edits to verify. Prefer git_status/git_diff for git; use localfs write for file edits.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Exact allowlisted command string (no shell chaining).",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_status",
      description: "Short git status for the Echo Mirage repo (real disk). Use after edits.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description:
        "Git diff for the Echo Mirage repo (real disk). Optional path limits to one file; stat=true for summary only.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Optional file path inside the workspace.",
          },
          stat: {
            type: "boolean",
            description: "If true, use git diff --stat (summary).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "justbash",
      description:
        "READ-ONLY sandbox: runs shell in a copy-on-write mirror (writes DO NOT persist). Use only for rg/ls/cat quick search. Never use for pnpm, git, or anything that must change or verify real files — use workspace_exec, git_status, git_diff, or localfs instead.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: 'Single shell command (e.g. `rg -n pattern src` or `ls -la`).',
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "localfs",
      description: buildLocalFsToolDescription(),
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["ls", "cat", "stat", "mkdir", "write"],
            description: buildLocalFsActionParamDescription(),
          },
          path: {
            type: "string",
            description: buildLocalFsPathParamDescription(),
          },
          content: {
            type: "string",
            description: 'Required for action write: full file contents as UTF-8 text.',
          },
          recursive: {
            type: "boolean",
            description: "mkdir only: create parent dirs (default true).",
          },
          append: {
            type: "boolean",
            description: "write only: append instead of overwrite (default false).",
          },
          ensure_parent_dirs: {
            type: "boolean",
            description: "write only: mkdir -p parent folders before writing (default true).",
          },
        },
        required: ["action", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_document_to_markdown",
      description:
        "Convert a local PDF or DOCX file to canonical markdown via MarkItDown. Use for operational intake into Echo Mirage.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Absolute or relative path to a .pdf or .docx file on the dev machine.",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_markdown_to_docx",
      description:
        "Convert a local markdown file to Word DOCX via @mohtasham/md-to-docx. Use for operator document export and cadre handoff.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Absolute or relative path to a .md or .markdown file on the dev machine.",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_markdown_to_pdf",
      description:
        "Convert a local markdown file to PDF via md-to-pdf (Puppeteer). Use for operator document export and cadre handoff.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Absolute or relative path to a .md or .markdown file on the dev machine.",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "operator_browser",
      description:
        "Operator web pane: goto returns LIVE PAGE TEXT during tool rounds (Playwright locally; Firecrawl primary; TinyFish Search/Fetch fallback on quota/paywall). One goto + one snapshot max. Do NOT use for local filesystem paths — use localfs instead.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["goto", "snapshot", "back", "forward", "reload", "click", "type", "submit"],
            description: "Browser action to perform in the operator web pane.",
          },
          url: {
            type: "string",
            description: "goto: absolute URL or site to open.",
          },
          query: {
            type: "string",
            description: "goto: search query when no direct URL (opens DuckDuckGo).",
          },
          selector: {
            type: "string",
            description: "click/type/submit: CSS selector in the visible page.",
          },
          value: {
            type: "string",
            description: "type: text to enter into the selected field.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "survey_auto_connect",
      description:
        "Survey Hub: wire Echo↔Mirage↔PowerFist with one action. Desktop reads Echo pins locally; HTTPS uses cloud relay with saved team ID. Call when the operator asks to connect/pair/link the survey team. Prerequisite: Echo Satellite Survey tab open.",
      parameters: {
        type: "object",
        properties: {
          echoHost: {
            type: "string",
            description: "Echo Satellite host (default 127.0.0.1 for same-machine dev).",
          },
          echoHttpPort: {
            type: "integer",
            description: "Echo Satellite HTTP port (default 3050).",
          },
          force: {
            type: "boolean",
            description: "Retry even if auto-pair ran recently (default true).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clock",
      description: "Current date/time on the server machine.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["time", "date", "datetime"],
            description: "What to report (default datetime).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_pi_control_lease",
      description:
        "Request operator grant for a temporary Pi control lease before desktop/computer-use missions. Pi is the embodiment operator for mouse, keyboard, and screen.",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "Short mission title shown in the control request UI (e.g. Draw Cat).",
          },
          reason: {
            type: "string",
            description: "Why computer use / embodiment is required.",
          },
          missionText: {
            type: "string",
            description: "Full operator mission text to pass to Pi after grant.",
          },
        },
        required: ["task", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delegate_pi_computer_use",
      description:
        "Delegate mission instructions to Pi after the operator grants the control lease. Monitors via Pi computer-use subsystem.",
      parameters: {
        type: "object",
        properties: {
          instructions: {
            type: "string",
            description: "Step-by-step mission for Pi to execute on the desktop.",
          },
        },
        required: ["instructions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pi_computer_use",
      description:
        "Execute one desktop action via Synapse (preferred) or windows-use fallback: screenshot, active_window, click, double_click, type, hotkey, scroll, move. " +
        "Requires active operator control lease. Screenshot first, then act step by step.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "screenshot",
              "active_window",
              "click",
              "double_click",
              "type",
              "hotkey",
              "scroll",
              "move",
            ],
          },
          x: { type: "number", description: "Screen X coordinate for click/move/type." },
          y: { type: "number", description: "Screen Y coordinate for click/move/type." },
          text: { type: "string", description: "Text to type (action=type)." },
          keys: {
            type: "array",
            items: { type: "string" },
            description: "Hotkey chord, e.g. [\"win\"], [\"ctrl\", \"c\"].",
          },
          direction: {
            type: "string",
            enum: ["up", "down"],
            description: "Scroll direction.",
          },
          amount: { type: "number", description: "Scroll amount." },
          button: {
            type: "string",
            enum: ["left", "right", "middle"],
            description: "Mouse button for click actions.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "samus_hands_eyes",
      description:
        "Samus-Manus hands-eyes: local Windows desktop control via pyautogui (mouse, keyboard, screenshot, template find). " +
        "Agent-mode direct embodiment on the machine running the dev server — not Pi delegation. " +
        "Screenshot first when UI state is unknown.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [...SAMUS_HANDS_EYES_ACTIONS],
          },
          x: { type: "number" },
          y: { type: "number" },
          x1: { type: "number" },
          y1: { type: "number" },
          x2: { type: "number" },
          y2: { type: "number" },
          dur: { type: "number", description: "Move/drag duration in seconds." },
          button: { type: "string", enum: ["left", "right", "middle"] },
          text: { type: "string", description: "Text for type/paste actions." },
          key: { type: "string", description: "Single key for press (e.g. enter, tab)." },
          keys: {
            type: "array",
            items: { type: "string" },
            description: "Hotkey chord for hotkey action (e.g. [\"ctrl\", \"s\"]).",
          },
          amount: { type: "number", description: "Scroll amount (negative=down)." },
          img: { type: "string", description: "Template image path for find_click / find_on_screen." },
          out: { type: "string", description: "Output path for screenshot action." },
          confidence: { type: "number", description: "Template match confidence 0–1 (default 0.8)." },
          timeout: { type: "number", description: "Seconds to search for template (default 3)." },
          click: { type: "boolean", description: "For find_click: click when found (default true)." },
          wait: { type: "number", description: "Seconds to wait after open_paint or before focus_codex click." },
          return_to_vscode: { type: "boolean", description: "Refocus VS Code after open_paint." },
          no_click: { type: "boolean", description: "For focus_codex: activate window only." },
          silent: { type: "boolean", description: "Suppress TTS announcements (default true)." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calyx_search",
      description:
        "Search the Echo Mirage Calyx vault (local association-native DB) with multi-lens fusion and optional guard.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural-language search query." },
          vault: { type: "string", description: "Vault name (default echo-mirage)." },
          k: { type: "integer", description: "Max hits (default 8)." },
          guard: { type: "string", enum: ["off", "in_region"] },
          explain: { type: "boolean" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calyx_ingest",
      description: "Ingest text into the Echo Mirage Calyx vault for grounded retrieval.",
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "Single document/text chunk to ingest." },
          batch: {
            type: "array",
            items: { type: "string" },
            description: "Multiple chunks to ingest in one call.",
          },
          vault: { type: "string", description: "Vault name (default echo-mirage)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calyx_kernel_answer",
      description:
        "Grounded answer from the Calyx kernel over ingested vault content. Fail-closed when unsupported.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Question to answer from the vault." },
          vault: { type: "string", description: "Vault name (default echo-mirage)." },
        },
        required: ["query"],
      },
    },
  },
];

export function getMuthurOpenAiToolsForPosture(posture: MuthurPosture, context?: MuthurPostureToolContext) {
  const directPi = isMuthurDirectPiComputerUseEnabled();
  const calyx = isCalyxMuthurToolsEnabled();
  const handsEyes = isSamusHandsEyesEnabled();
  return MUTHUR_OPENAI_TOOLS.filter((tool) => {
    if (tool.function.name === "pi_computer_use" && !directPi) return false;
    if (tool.function.name === "delegate_pi_computer_use" && directPi) return false;
    if (tool.function.name === "samus_hands_eyes" && !handsEyes) return false;
    if (
      (tool.function.name === "calyx_search" ||
        tool.function.name === "calyx_ingest" ||
        tool.function.name === "calyx_kernel_answer") &&
      !calyx
    ) {
      return false;
    }
    return isToolAllowedForPosture(posture, tool.function.name, context);
  });
}
