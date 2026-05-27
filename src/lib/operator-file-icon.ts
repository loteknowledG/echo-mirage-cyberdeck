const ICON_BASE_PATH = "/vendor/vscode-icons";

const FILE_NAME_ICONS: Record<string, string> = {
  ".env": "file_type_dotenv.svg",
  ".env.local": "file_type_dotenv.svg",
  "dockerfile": "file_type_docker.svg",
  "next.config.js": "file_type_next.svg",
  "next.config.mjs": "file_type_next.svg",
  "next.config.ts": "file_type_next.svg",
  "package-lock.json": "file_type_npm.svg",
  "package.json": "file_type_npm.svg",
  "pnpm-lock.yaml": "file_type_pnpm.svg",
  "pnpm-workspace.yaml": "file_type_pnpm.svg",
};

const FILE_EXTENSION_ICONS: Record<string, string> = {
  css: "file_type_css.svg",
  gif: "file_type_image.svg",
  htm: "file_type_html.svg",
  html: "file_type_html.svg",
  jpeg: "file_type_image.svg",
  jpg: "file_type_image.svg",
  js: "file_type_js.svg",
  jsx: "file_type_reactjs.svg",
  json: "file_type_json.svg",
  md: "file_type_markdown.svg",
  mdx: "file_type_markdown.svg",
  pdf: "file_type_pdf.svg",
  png: "file_type_image.svg",
  ps1: "file_type_powershell.svg",
  sh: "file_type_shell.svg",
  svg: "file_type_svg.svg",
  ts: "file_type_typescript.svg",
  tsx: "file_type_reactts.svg",
  webp: "file_type_image.svg",
  yaml: "file_type_yaml.svg",
  yml: "file_type_yaml.svg",
  zsh: "file_type_shell.svg",
};

const FOLDER_ICONS: Record<string, string> = {
  doc: "docs",
  docs: "docs",
  e2e: "test",
  public: "public",
  src: "src",
  test: "test",
  tests: "test",
};

export function operatorFileIcon(name: string): string {
  const normalizedName = name.toLowerCase();
  const namedIcon = FILE_NAME_ICONS[normalizedName];
  if (namedIcon) return namedIcon;

  const extension = normalizedName.slice(normalizedName.lastIndexOf(".") + 1);
  return FILE_EXTENSION_ICONS[extension] ?? "default_file.svg";
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
