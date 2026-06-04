import {
  isOperatorFolderIgnored,
  OPERATOR_FOLDER_LIST_MAX_ENTRIES,
  type OperatorFolderTreeNode,
} from "@/lib/operator-folder-nav";

/** In-memory folder tree built from `<input webkitdirectory>` (mobile / Safari fallback). */
export type OperatorFolderSnapshot = {
  filesByLogicalPath: Map<string, File>;
  childrenByDirPath: Map<string, OperatorFolderTreeNode[]>;
};

function sortNodes(nodes: OperatorFolderTreeNode[]): OperatorFolderTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function capNodes(nodes: OperatorFolderTreeNode[], dirPath: string): OperatorFolderTreeNode[] {
  if (nodes.length <= OPERATOR_FOLDER_LIST_MAX_ENTRIES) return nodes;
  const kept = nodes.slice(0, OPERATOR_FOLDER_LIST_MAX_ENTRIES);
  kept.push({
    name: "… more entries",
    path: `${dirPath}/__truncated__`,
    kind: "folder",
    truncated: true,
    ignored: true,
  });
  return kept;
}

/**
 * Build a browsable tree from files returned by a directory `<input>` (webkitRelativePath).
 * @param rootName When set, use this as the tree root label (must match relabeled operator root).
 */
export function buildOperatorFolderSnapshot(
  files: File[],
  rootName?: string,
): {
  rootSegment: string;
  snapshot: OperatorFolderSnapshot;
} | null {
  if (files.length === 0) return null;

  const normalized = files
    .map((file) => ({
      file,
      rel: (file.webkitRelativePath || file.name).replace(/\\/g, "/"),
    }))
    .filter((entry) => entry.rel.trim().length > 0);

  if (normalized.length === 0) return null;

  const pickedSegment = normalized[0].rel.split("/").filter(Boolean)[0] || "folder";
  const rootSegment = rootName?.trim() || pickedSegment;
  const filesByLogicalPath = new Map<string, File>();
  const childMaps = new Map<string, Map<string, OperatorFolderTreeNode>>();

  const ensureDirMap = (dirPath: string) => {
    let map = childMaps.get(dirPath);
    if (!map) {
      map = new Map();
      childMaps.set(dirPath, map);
    }
    return map;
  };

  const addChild = (dirPath: string, node: OperatorFolderTreeNode) => {
    const map = ensureDirMap(dirPath);
    if (!map.has(node.path)) map.set(node.path, node);
  };

  for (const { file, rel } of normalized) {
    const parts = rel.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    const innerParts = parts[0] === pickedSegment ? parts.slice(1) : parts;
    if (innerParts.length === 0) continue;

    const fileName = innerParts[innerParts.length - 1];
    const logicalPath = `${rootSegment}/${innerParts.join("/")}`;

    if (innerParts.length === 1) {
      filesByLogicalPath.set(logicalPath, file);
      addChild(rootSegment, {
        name: fileName,
        path: logicalPath,
        kind: "file",
      });
      continue;
    }

    filesByLogicalPath.set(logicalPath, file);

    let dirPath = rootSegment;
    for (let i = 0; i < innerParts.length - 1; i += 1) {
      const segment = innerParts[i];
      const folderPath = `${dirPath}/${segment}`;
      if (isOperatorFolderIgnored(segment)) {
        addChild(dirPath, {
          name: segment,
          path: folderPath,
          kind: "folder",
          ignored: true,
        });
        dirPath = folderPath;
        continue;
      }
      addChild(dirPath, {
        name: segment,
        path: folderPath,
        kind: "folder",
      });
      dirPath = folderPath;
    }

    addChild(dirPath, {
      name: fileName,
      path: logicalPath,
      kind: "file",
    });
  }

  const childrenByDirPath = new Map<string, OperatorFolderTreeNode[]>();
  for (const [dirPath, map] of childMaps) {
    childrenByDirPath.set(dirPath, capNodes(sortNodes([...map.values()]), dirPath));
  }
  if (!childrenByDirPath.has(rootSegment)) {
    childrenByDirPath.set(rootSegment, []);
  }

  return {
    rootSegment,
    snapshot: { filesByLogicalPath, childrenByDirPath },
  };
}

export function listSnapshotDirectoryChildren(
  snapshot: OperatorFolderSnapshot,
  logicalPath: string,
): OperatorFolderTreeNode[] {
  return snapshot.childrenByDirPath.get(logicalPath) ?? [];
}

export function readSnapshotFile(
  snapshot: OperatorFolderSnapshot,
  logicalPath: string,
): File | null {
  return snapshot.filesByLogicalPath.get(logicalPath) ?? null;
}

export function supportsWebkitDirectoryInput(): boolean {
  if (typeof document === "undefined") return false;
  const input = document.createElement("input");
  return "webkitdirectory" in input;
}

export function supportsFileSystemDirectoryPicker(): boolean {
  return typeof (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> })
    .showDirectoryPicker === "function";
}
