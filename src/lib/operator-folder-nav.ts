import { isOperatorBinaryPreviewPath } from "@/lib/operator-binary-preview";
import type { OperatorFolderSnapshot } from "@/lib/operator-folder-snapshot";
import {
  listSnapshotDirectoryChildren,
  readSnapshotFile,
} from "@/lib/operator-folder-snapshot";

export type OperatorDocFolderRoot = {
  id: string;
  name: string;
  /** Browser File System Access API handle (web fallback). */
  handle?: FileSystemDirectoryHandle;
  /** Absolute disk path when using the Echo Mirage desktop bridge. */
  diskPath?: string;
  /** Mobile / webkitdirectory pick — tree lives in memory until reload. */
  snapshot?: OperatorFolderSnapshot;
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
  if (root.snapshot) {
    return listSnapshotDirectoryChildren(root.snapshot, logicalPath);
  }

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

export type OperatorFolderFileRead = {
  file: File;
  diskAbsolutePath?: string;
  fileSize?: number;
  pdfBase64?: string;
  inlineBase64?: string;
};

export function resolveOperatorDiskAbsolutePath(
  root: OperatorDocFolderRoot,
  logicalPath: string,
): string | undefined {
  if (!root.diskPath) return undefined;
  const relativePath =
    logicalPath === root.name
      ? ""
      : logicalPath.startsWith(`${root.name}/`)
        ? logicalPath.slice(root.name.length + 1)
        : logicalPath;
  if (!relativePath) return root.diskPath;
  const separator = root.diskPath.includes("\\") ? "\\" : "/";
  return `${root.diskPath.replace(/[\\/]+$/, "")}${separator}${relativePath.replaceAll("/", separator)}`;
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
): Promise<OperatorFolderFileRead | null> {
  const diskAbsolutePath = resolveOperatorDiskAbsolutePath(root, logicalPath);
  const binaryPath = isOperatorBinaryPreviewPath(logicalPath);

  if (root.snapshot) {
    const file = readSnapshotFile(root.snapshot, logicalPath);
    return file ? { file } : null;
  }

  if (root.handle && binaryPath) {
    const file = await readFileFromFolderPath(root.handle, logicalPath);
    return file ? { file, diskAbsolutePath } : null;
  }

  const bridge = window.echoMirageOpen;
  if (root.diskPath && bridge?.readOperatorFile) {
    const result = await bridge.readOperatorFile(root.diskPath, logicalPath);
    if (!result.ok || !result.name) return null;

    const absolutePath = result.filePath || diskAbsolutePath;

    const reportedSize = result.size ?? 0;

    if (result.largeBinary && absolutePath) {
      const file = new File([], result.name, {
        type: result.mimeType || "application/octet-stream",
        lastModified: Date.now(),
      });
      return {
        file,
        diskAbsolutePath: absolutePath,
        fileSize: reportedSize,
      };
    }

    if (result.base64) {
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: result.mimeType || "application/octet-stream",
      });
      const file = new File([blob], result.name, {
        type: result.mimeType || "application/octet-stream",
        lastModified: Date.now(),
      });
      const lowerName = result.name.toLowerCase();
      const isPdf = result.mimeType === "application/pdf" || lowerName.endsWith(".pdf");
      const isDocx =
        result.mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        lowerName.endsWith(".docx");
      const isImage =
        result.mimeType?.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(lowerName);
      return {
        file,
        diskAbsolutePath: absolutePath,
        fileSize: reportedSize || file.size,
        ...(isPdf ? { pdfBase64: result.base64 } : {}),
        ...(isDocx || isImage ? { inlineBase64: result.base64 } : {}),
      };
    }

    if (result.binaryMetadata) {
      const file = new File([], result.name, {
        type: result.mimeType || "application/octet-stream",
        lastModified: Date.now(),
      });
      return { file, diskAbsolutePath: absolutePath };
    }

    if (binaryPath && result.text != null) {
      if (root.handle) {
        const file = await readFileFromFolderPath(root.handle, logicalPath);
        return file ? { file, diskAbsolutePath } : null;
      }
      return null;
    }

    if (result.text == null) return null;
    const file = new File([result.text], result.name, {
      type: result.mimeType || "text/plain",
      lastModified: Date.now(),
    });
    return { file, diskAbsolutePath: absolutePath };
  }

  if (!root.handle) return null;
  const file = await readFileFromFolderPath(root.handle, logicalPath);
  return file ? { file, diskAbsolutePath } : null;
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
