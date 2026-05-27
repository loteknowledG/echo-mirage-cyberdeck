export type OperatorDocFolderRoot = {
  id: string;
  name: string;
  /** Browser File System Access API handle (web fallback). */
  handle?: FileSystemDirectoryHandle;
  /** Absolute disk path when using the Echo Mirage desktop bridge. */
  diskPath?: string;
};

export type OperatorFolderTreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder";
  /** Heavy directory — listed but not expandable in the operator pane. */
  ignored?: boolean;
  /** Directory had more entries than the list cap. */
  truncated?: boolean;
  children?: OperatorFolderTreeNode[];
};

/** Never enumerate these — they freeze the File System Access API on real repos. */
export const OPERATOR_FOLDER_IGNORED_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  ".pnpm-store",
  ".cache",
  ".muthur",
]);

export const OPERATOR_FOLDER_LIST_MAX_ENTRIES = 400;

const FSA_LIST_TIMEOUT_MS = 20_000;

export function isOperatorFolderIgnored(name: string): boolean {
  return OPERATOR_FOLDER_IGNORED_NAMES.has(name);
}

function relativePathFromLogicalPath(rootName: string, logicalPath: string): string {
  if (logicalPath === rootName) return "";
  const prefix = `${rootName}/`;
  return logicalPath.startsWith(prefix) ? logicalPath.slice(prefix.length) : "";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ensureDirectoryPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const query = (
    handle as FileSystemDirectoryHandle & {
      queryPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
      requestPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
    }
  ).queryPermission;
  if (typeof query !== "function") return true;

  const state = await query.call(handle, { mode: "read" });
  if (state === "granted") return true;

  const request = (
    handle as FileSystemDirectoryHandle & {
      requestPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
    }
  ).requestPermission;
  if (typeof request !== "function") return false;
  return (await request.call(handle, { mode: "read" })) === "granted";
}

export async function listDirectoryChildrenFromHandle(
  handle: FileSystemDirectoryHandle,
  pathPrefix: string,
): Promise<OperatorFolderTreeNode[]> {
  const permitted = await ensureDirectoryPermission(handle);
  if (!permitted) {
    throw new Error("Folder read permission was not granted.");
  }

  const nodes: OperatorFolderTreeNode[] = [];
  const iter = (
    handle as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }
  ).entries();

  let result = await iter.next();
  let truncated = false;
  while (!result.done) {
    const [entryName, entryHandle] = result.value;
    const entryPath = `${pathPrefix}/${entryName}`;
    if (entryHandle.kind === "directory") {
      if (isOperatorFolderIgnored(entryName)) {
        nodes.push({ name: entryName, path: entryPath, kind: "folder", ignored: true });
      } else {
        nodes.push({ name: entryName, path: entryPath, kind: "folder" });
      }
    } else {
      nodes.push({ name: entryName, path: entryPath, kind: "file" });
    }

    if (nodes.length > OPERATOR_FOLDER_LIST_MAX_ENTRIES) {
      truncated = true;
      break;
    }

    result = await iter.next();
  }

  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (!truncated) {
    return nodes;
  }

  const kept = nodes.slice(0, OPERATOR_FOLDER_LIST_MAX_ENTRIES);
  kept.push({
    name: "… more entries",
    path: `${pathPrefix}/__truncated__`,
    kind: "folder",
    truncated: true,
    ignored: true,
  });
  return kept;
}

export async function listDirectoryChildrenForRoot(
  root: OperatorDocFolderRoot,
  logicalPath: string,
): Promise<OperatorFolderTreeNode[]> {
  const bridge = window.echoMirageOpen;
  if (root.diskPath && bridge?.listOperatorFolder) {
    const relativePath = relativePathFromLogicalPath(root.name, logicalPath);
    const result = await bridge.listOperatorFolder(root.diskPath, relativePath, logicalPath);
    if (!result.ok || !result.nodes) {
      throw new Error(result.error || "Could not list folder.");
    }
    return result.nodes;
  }

  if (!root.handle) {
    throw new Error("Folder handle is unavailable.");
  }

  let current = root.handle;
  const parts = relativePathFromLogicalPath(root.name, logicalPath).split("/").filter(Boolean);
  for (const part of parts) {
    current = await current.getDirectoryHandle(part);
  }

  return withTimeout(
    listDirectoryChildrenFromHandle(current, logicalPath),
    FSA_LIST_TIMEOUT_MS,
    "Folder listing timed out. Use the Echo Mirage desktop app for large repos.",
  );
}

export async function resolveDirectoryHandle(
  root: FileSystemDirectoryHandle,
  pathParts: string[],
): Promise<FileSystemDirectoryHandle | null> {
  let current: FileSystemDirectoryHandle = root;
  for (const part of pathParts) {
    if (isOperatorFolderIgnored(part)) return null;
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return current;
}

export async function writeFileToFolderRoot(
  root: OperatorDocFolderRoot,
  logicalPath: string,
  content: string,
): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  const bridge = window.echoMirageOpen;
  if (!root.diskPath || !bridge?.writeOperatorFile) {
    return { ok: false, error: "In-place save requires the Echo Mirage desktop app." };
  }
  return bridge.writeOperatorFile(root.diskPath, logicalPath, content);
}

export function isOperatorFolderPaneFilePath(filePath: string | null | undefined): filePath is string {
  if (!filePath?.trim()) return false;
  return !/^[a-z+]+:\/\//i.test(filePath);
}

export function canSaveOperatorFileInPlace(
  filePath: string | null | undefined,
  roots: OperatorDocFolderRoot[],
): boolean {
  if (!isOperatorFolderPaneFilePath(filePath)) return false;
  const rootName = filePath.split("/")[0];
  const root = roots.find((entry) => entry.name === rootName);
  return Boolean(root?.diskPath && window.echoMirageOpen?.writeOperatorFile);
}

export async function readFileFromFolderRoot(
  root: OperatorDocFolderRoot,
  logicalPath: string,
): Promise<File | null> {
  const bridge = window.echoMirageOpen;
  if (root.diskPath && bridge?.readOperatorFile) {
    const result = await bridge.readOperatorFile(root.diskPath, logicalPath);
    if (!result.ok || result.text == null || !result.name) return null;
    return new File([result.text], result.name, {
      type: result.mimeType || "text/plain",
      lastModified: Date.now(),
    });
  }

  if (!root.handle) return null;
  return readFileFromFolderPath(root.handle, logicalPath);
}

export async function readFileFromFolderPath(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<File | null> {
  const parts = path.split("/").slice(1);
  if (parts.length === 0) return null;

  let current: FileSystemDirectoryHandle = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (isOperatorFolderIgnored(parts[i])) return null;
    const next = await resolveDirectoryHandle(current, [parts[i]]);
    if (!next) return null;
    current = next;
  }

  try {
    const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

export function mergeFolderTreeNodes(
  rootNodes: OperatorFolderTreeNode[],
  path: string,
  children: OperatorFolderTreeNode[],
): OperatorFolderTreeNode[] {
  return rootNodes.map((node) => {
    if (node.path === path) return { ...node, children };
    if (node.children) return { ...node, children: mergeFolderTreeNodes(node.children, path, children) };
    return node;
  });
}

/** @deprecated Use listDirectoryChildrenForRoot */
export async function listDirectoryChildren(
  handle: FileSystemDirectoryHandle,
  pathPrefix: string,
): Promise<OperatorFolderTreeNode[]> {
  return listDirectoryChildrenFromHandle(handle, pathPrefix);
}
