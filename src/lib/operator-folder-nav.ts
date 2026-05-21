export type OperatorFolderTreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder";
  children?: OperatorFolderTreeNode[];
};

export async function listDirectoryChildren(
  handle: FileSystemDirectoryHandle,
  pathPrefix: string,
): Promise<OperatorFolderTreeNode[]> {
  const nodes: OperatorFolderTreeNode[] = [];
  const iter = (
    handle as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }
  ).entries();
  let result = await iter.next();
  while (!result.done) {
    const [entryName, entryHandle] = result.value;
    const entryPath = `${pathPrefix}/${entryName}`;
    if (entryHandle.kind === "directory") {
      nodes.push({ name: entryName, path: entryPath, kind: "folder" });
    } else {
      nodes.push({ name: entryName, path: entryPath, kind: "file" });
    }
    result = await iter.next();
  }
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export async function resolveDirectoryHandle(
  root: FileSystemDirectoryHandle,
  pathParts: string[],
): Promise<FileSystemDirectoryHandle | null> {
  let current: FileSystemDirectoryHandle = root;
  for (const part of pathParts) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return current;
}

export async function readFileFromFolderPath(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<File | null> {
  const parts = path.split("/").slice(1);
  if (parts.length === 0) return null;

  let current: FileSystemDirectoryHandle = root;
  for (let i = 0; i < parts.length - 1; i++) {
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
