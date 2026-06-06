const ICON_BASE_PATH = "/vendor/vscode-icons";

const FILE_NAME_ICONS: Record<string, string> = {
  ".env": "file_type_dotenv.svg",
  ".env.local": "file_type_dotenv.svg",
  ".gitattributes": "file_type_git.svg",
  ".gitignore": "file_type_git.svg",
  ".gitmodules": "file_type_git.svg",
  "dockerfile": "file_type_docker.svg",
  "eslint.config.js": "file_type_eslint.svg",
  "eslint.config.mjs": "file_type_eslint.svg",
  "eslint.config.ts": "file_type_eslint.svg",
  "next.config.js": "file_type_next.svg",
  "next.config.mjs": "file_type_next.svg",
  "next.config.ts": "file_type_next.svg",
  "package-lock.json": "file_type_npm.svg",
  "package.json": "file_type_npm.svg",
  "pnpm-lock.yaml": "file_type_pnpm.svg",
  "pnpm-workspace.yaml": "file_type_pnpm.svg",
  "postcss.config.js": "file_type_postcss.svg",
  "postcss.config.mjs": "file_type_postcss.svg",
  "postcss.config.ts": "file_type_postcss.svg",
  "prettier.config.js": "file_type_prettier.svg",
  "prettier.config.mjs": "file_type_prettier.svg",
  "tailwind.config.js": "file_type_tailwind.svg",
  "tailwind.config.mjs": "file_type_tailwind.svg",
  "tailwind.config.ts": "file_type_tailwind.svg",
  "tsconfig.json": "file_type_tsconfig.svg",
  "tsconfig.tsbuildinfo": "file_type_tsconfig.svg",
};

const FILE_EXTENSION_ICONS: Record<string, string> = {
  css: "file_type_css.svg",
  db: "file_type_light_db.svg",
  flf: "file_type_font.svg",
  gif: "file_type_image.svg",
  htm: "file_type_html.svg",
  html: "file_type_html.svg",
  jpeg: "file_type_image.svg",
  jpg: "file_type_image.svg",
  js: "file_type_js.svg",
  jsx: "file_type_reactjs.svg",
  json: "file_type_json.svg",
  log: "file_type_log.svg",
  md: "file_type_markdown.svg",
  mdx: "file_type_markdown.svg",
  docx: "file_type_word.svg",
  doc: "file_type_word.svg",
  pdf: "file_type_pdf.svg",
  png: "file_type_image.svg",
  ps1: "file_type_powershell.svg",
  py: "file_type_python.svg",
  sh: "file_type_shell.svg",
  svg: "file_type_svg.svg",
  txt: "file_type_text.svg",
  ts: "file_type_typescript.svg",
  tsx: "file_type_reactts.svg",
  webp: "file_type_image.svg",
  yaml: "file_type_yaml.svg",
  yml: "file_type_yaml.svg",
  zsh: "file_type_shell.svg",
};

const DOCUMENT_KIND_SAMPLE_FILES: Record<string, string> = {
  css: "operator.css",
  html: "operator.html",
  javascript: "operator.js",
  json: "operator.json",
  markdown: "operator.md",
  docx: "operator.docx",
  pdf: "operator.pdf",
  python: "operator.py",
  text: "operator.txt",
  typescript: "operator.ts",
};

const FOLDER_ICONS: Record<string, string> = {
  __pycache__: "python",
  doc: "docs",
  docs: "docs",
  e2e: "test",
  node_modules: "node",
  public: "public",
  src: "src",
  test: "test",
  tests: "test",
  tool: "tools",
  tooling: "tools",
  tools: "tools",
};

export function operatorFileIcon(name: string): string {
  const normalizedName = name.toLowerCase();
  const namedIcon = FILE_NAME_ICONS[normalizedName];
  if (namedIcon) return namedIcon;

  if (normalizedName.endsWith(".d.ts")) return "file_type_typescriptdef.svg";
  if (normalizedName.endsWith(".db-shm") || normalizedName.endsWith(".db-wal")) return "file_type_light_db.svg";
  if (normalizedName.endsWith(".config.json")) return "file_type_config.svg";

  const extension = normalizedName.slice(normalizedName.lastIndexOf(".") + 1);
  return FILE_EXTENSION_ICONS[extension] ?? "default_file.svg";
}

export function operatorDocumentKindIcon(kind: string): string {
  return operatorFileIcon(DOCUMENT_KIND_SAMPLE_FILES[kind] ?? "operator.txt");
}

export function operatorFolderIcon(name: string, expanded: boolean, root = false): string {
  if (root) return expanded ? "default_root_folder_opened.svg" : "default_root_folder.svg";

  const folderType = FOLDER_ICONS[name.toLowerCase()];
  if (folderType) return `folder_type_${folderType}${expanded ? "_opened" : ""}.svg`;
  return expanded ? "default_folder_opened.svg" : "default_folder.svg";
}

export function operatorIconSrc(icon: string): string {
  return `${ICON_BASE_PATH}/${icon}`;
}
