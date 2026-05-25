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
      name: "justbash",
      description:
        "Runs a shell command in a copy-on-write workspace mirror of the Echo Mirage project (reads real files; writes are ephemeral). Use for rg/git/ls/cat inside the repo, quick inspection.",
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
      description:
        "Filesystem on the machine running the Next dev server. ls, cat, stat on any readable path. mkdir and write only inside the Echo Mirage workspace project root (not outside the repo). write creates parent directories by default.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["ls", "cat", "stat", "mkdir", "write"],
            description:
              "ls = list directory, cat = read text file, stat = metadata. mkdir = create directory (workspace only). write = create/overwrite or append a text file (workspace only).",
          },
          path: {
            type: "string",
            description: "Absolute or relative path; writes are resolved under the workspace root only.",
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
];
