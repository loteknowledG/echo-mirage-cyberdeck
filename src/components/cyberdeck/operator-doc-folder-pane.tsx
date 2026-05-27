'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LuChevronDown,
  LuChevronRight,
  LuFile,
  LuFolder,
  LuFolderPlus,
  LuRefreshCw,
  LuX,
} from "react-icons/lu";
import { useDeckMode } from "@/lib/deck-mode";
import { realmorphismActionClass } from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";
import {
  listDirectoryChildrenForRoot,
  mergeFolderTreeNodes,
  readFileFromFolderRoot,
  type OperatorDocFolderRoot,
  type OperatorFolderTreeNode,
} from "@/lib/operator-folder-nav";

type OperatorDocFolderPaneProps = {
  onOpenFile: (path: string, file: File) => void | Promise<void>;
  onRootsChange?: (roots: OperatorDocFolderRoot[]) => void;
};

function uniqueRootLabel(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let index = 2;
  while (existing.includes(`${base} (${index})`)) index += 1;
  return `${base} (${index})`;
}

function createRootFromDisk(folderPath: string, label: string): OperatorDocFolderRoot {
  return {
    id: crypto.randomUUID(),
    name: label,
    diskPath: folderPath,
  };
}

function createRootFromHandle(handle: FileSystemDirectoryHandle, label: string): OperatorDocFolderRoot {
  return {
    id: crypto.randomUUID(),
    name: label,
    handle,
  };
}

export function OperatorDocFolderPane({ onOpenFile, onRootsChange }: OperatorDocFolderPaneProps) {
  const deckMode = useDeckMode();
  const [roots, setRoots] = useState<OperatorDocFolderRoot[]>([]);
  const [tree, setTree] = useState<Record<string, OperatorFolderTreeNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [replacingRootId, setReplacingRootId] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const isPickingRef = useRef(false);

  const setPathLoading = useCallback((path: string, loading: boolean) => {
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      if (loading) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const clearRootState = useCallback((rootName: string) => {
    setTree((prev) => {
      const next = { ...prev };
      delete next[rootName];
      return next;
    });
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const path of prev) {
        if (path === rootName || path.startsWith(`${rootName}/`)) next.delete(path);
      }
      return next;
    });
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      for (const path of prev) {
        if (path === rootName || path.startsWith(`${rootName}/`)) next.delete(path);
      }
      return next;
    });
    setSelectedPath((prev) => (prev?.startsWith(rootName) ? null : prev));
  }, []);

  useEffect(() => {
    onRootsChange?.(roots);
  }, [onRootsChange, roots]);

  const pickDirectoryRoot = useCallback(async (): Promise<OperatorDocFolderRoot | null> => {
    const bridge = window.echoMirageOpen;
    if (bridge?.pickOperatorFolder) {
      const result = await bridge.pickOperatorFolder();
      if (result.canceled) return null;
      if (result.error) {
        toast.error(result.error);
        return null;
      }
      if (!result.folderPath) return null;
      const baseName = result.name || "folder";
      return createRootFromDisk(result.folderPath, baseName);
    }

    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    if (typeof picker !== "function") {
      toast.error("Folder picker is not available in this browser.");
      return null;
    }
    const dirHandle = await picker();
    const baseName = dirHandle.name || "folder";
    return createRootFromHandle(dirHandle, baseName);
  }, []);

  const handleAddFolder = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setIsPicking(true);
    try {
      const picked = await pickDirectoryRoot();
      if (!picked) return;

      setRoots((prev) => {
        const label = uniqueRootLabel(picked.name, prev.map((root) => root.name));
        return [...prev, { ...picked, name: label }];
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not add folder.");
    } finally {
      isPickingRef.current = false;
      setIsPicking(false);
    }
  }, [pickDirectoryRoot]);

  const handleReplaceRoot = useCallback(
    async (rootId: string) => {
      if (isPickingRef.current) return;
      const current = roots.find((root) => root.id === rootId);
      if (!current) return;

      isPickingRef.current = true;
      setReplacingRootId(rootId);
      try {
        const picked = await pickDirectoryRoot();
        if (!picked) return;

        setRoots((prev) => {
          const others = prev.filter((root) => root.id !== rootId).map((root) => root.name);
          const label = uniqueRootLabel(picked.name, others);
          return prev.map((root) =>
            root.id === rootId
              ? {
                  ...root,
                  name: label,
                  diskPath: picked.diskPath,
                  handle: picked.handle,
                }
              : root,
          );
        });
        clearRootState(current.name);
        toast.message("Folder slot updated.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error(error instanceof Error ? error.message : "Could not replace folder.");
      } finally {
        isPickingRef.current = false;
        setReplacingRootId(null);
      }
    },
    [clearRootState, pickDirectoryRoot, roots],
  );

  const handleRemoveRoot = useCallback(
    (rootId: string) => {
      const current = roots.find((root) => root.id === rootId);
      if (!current) return;
      setRoots((prev) => prev.filter((root) => root.id !== rootId));
      clearRootState(current.name);
    },
    [clearRootState, roots],
  );

  const handleToggleFolder = useCallback(
    async (rootName: string, path: string, node?: OperatorFolderTreeNode) => {
      if (node?.ignored) {
        if (node.truncated) {
          toast.message("Folder has more entries than the operator pane lists. Narrow to a subfolder.");
        } else {
          toast.message(`"${node.name}" is skipped in the operator pane (large system folder).`);
        }
        return;
      }

      const root = roots.find((entry) => entry.name === rootName);
      if (!root) return;

      if (expanded.has(path)) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        return;
      }

      const existing = tree[rootName];
      const cachedChildren =
        path === rootName
          ? existing && existing.length > 0
            ? existing
            : undefined
          : existing
            ? findNodeChildren(existing, path)
            : undefined;
      if (cachedChildren) {
        setExpanded((prev) => new Set(prev).add(path));
        return;
      }

      if (loadingPaths.has(path)) return;

      setPathLoading(path, true);
      try {
        const nodes = await listDirectoryChildrenForRoot(root, path);
        setExpanded((prev) => new Set(prev).add(path));
        setTree((prev) => ({
          ...prev,
          [rootName]:
            path === rootName ? nodes : mergeFolderTreeNodes(prev[rootName] || [], path, nodes),
        }));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : `Could not open folder "${path.split("/").pop()}".`,
        );
      } finally {
        setPathLoading(path, false);
      }
    },
    [expanded, loadingPaths, roots, tree, setPathLoading],
  );

  const handleSelectFile = useCallback(
    async (rootName: string, path: string) => {
      const root = roots.find((entry) => entry.name === rootName);
      if (!root) return;

      setSelectedPath(path);
      setOpeningPath(path);
      try {
        const file = await readFileFromFolderRoot(root, path);
        if (file) await onOpenFile(path, file);
        else toast.error("Could not read file.");
      } finally {
        setOpeningPath(null);
      }
    },
    [onOpenFile, roots],
  );

  const renderTree = useCallback(
    (nodes: OperatorFolderTreeNode[], depth: number, rootName: string) =>
      nodes.map((node) => {
        const isExpanded = expanded.has(node.path);
        const isSelected = selectedPath === node.path;
        const isOpening = openingPath === node.path;
        const isLoading = loadingPaths.has(node.path);

        return (
          <div key={node.path}>
            <button
              type="button"
              className={`flex w-full cursor-pointer items-center gap-1 px-1 py-0.5 text-left hover:bg-[#151515] ${
                isSelected ? "text-emerald-400" : node.ignored ? "text-[#666]" : "text-[#888]"
              }`}
              style={{ paddingLeft: `${depth * 12}px` }}
              onClick={() =>
                node.kind === "folder"
                  ? void handleToggleFolder(rootName, node.path, node)
                  : void handleSelectFile(rootName, node.path)
              }
            >
              {node.kind === "folder" ? (
                isLoading ? (
                  <span className="w-2.5 animate-pulse text-[#555]">…</span>
                ) : isExpanded ? (
                  <LuChevronDown size={10} />
                ) : (
                  <LuChevronRight size={10} />
                )
              ) : (
                <span className="w-2.5" />
              )}
              {node.kind === "folder" ? (
                <LuFolder size={10} className={cn("shrink-0", node.ignored ? "text-[#555]" : "text-yellow-600")} />
              ) : (
                <LuFile size={10} className="shrink-0 text-blue-400" />
              )}
              <span className="truncate font-mono text-[10px]">
                {node.name}
                {isOpening ? " …" : ""}
              </span>
            </button>
            {node.kind === "folder" && isExpanded && node.children ? (
              renderTree(node.children, depth + 1, rootName)
            ) : null}
          </div>
        );
      }),
    [expanded, handleSelectFile, handleToggleFolder, loadingPaths, openingPath, selectedPath],
  );

  return (
    <aside className="flex w-44 shrink-0 flex-col border-l border-[#1c1c1c] bg-black">
      <div className="border-b border-[#1c1c1c] p-2">
        <button
          type="button"
          onClick={() => void handleAddFolder()}
          disabled={isPicking}
          className={cn(realmorphismActionClass(deckMode, "neutral"), "w-full py-1.5")}
        >
          <span className="flex w-full items-center gap-1.5">
            <LuFolderPlus size={11} />
            {isPicking && !replacingRootId ? "PICKING…" : "ADD FOLDER"}
          </span>
        </button>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto py-1">
        {roots.length === 0 ? (
          <div className="px-3 py-4 text-center font-mono text-[9px] tracking-[0.06em] text-[#5a5a5a]">
            ADD FOLDER TO BROWSE DOCS
          </div>
        ) : (
          roots.map((root) => {
            const rootLoading = loadingPaths.has(root.name);
            const rootExpanded = expanded.has(root.name);
            const rootChildren = tree[root.name];
            const isReplacing = replacingRootId === root.id;
            return (
              <div key={root.id}>
                <div className="flex items-center gap-1 px-2 py-1 hover:bg-[#111]">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left"
                    onClick={() => void handleToggleFolder(root.name, root.name)}
                  >
                    {rootLoading || isReplacing ? (
                      <span className="w-2.5 shrink-0 animate-pulse text-[#555]">…</span>
                    ) : rootExpanded ? (
                      <LuChevronDown size={10} className="shrink-0 text-[#555]" />
                    ) : (
                      <LuChevronRight size={10} className="shrink-0 text-[#555]" />
                    )}
                    <LuFolder size={10} className="shrink-0 text-yellow-600" />
                    <span className="truncate font-mono text-[10px] text-[#999]" title={root.name}>
                      {root.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReplaceRoot(root.id)}
                    disabled={isPicking}
                    className="shrink-0 text-[#444] transition hover:text-emerald-400 disabled:opacity-30"
                    aria-label={`Replace folder ${root.name}`}
                    title="Replace folder"
                  >
                    <LuRefreshCw size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveRoot(root.id)}
                    className="shrink-0 text-[#444] transition hover:text-red-400"
                    aria-label={`Remove folder ${root.name}`}
                  >
                    <LuX size={10} />
                  </button>
                </div>
                {rootExpanded ? (
                  rootChildren?.length ? (
                    <div>{renderTree(rootChildren, 1, root.name)}</div>
                  ) : rootLoading ? (
                    <div className="px-4 py-1 font-mono text-[9px] text-[#555]">LISTING…</div>
                  ) : (
                    <div className="px-4 py-1 font-mono text-[9px] text-[#555]">EMPTY</div>
                  )
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function findNodeChildren(
  nodes: OperatorFolderTreeNode[],
  path: string,
): OperatorFolderTreeNode[] | undefined {
  for (const node of nodes) {
    if (node.path === path) return node.children;
    if (node.children) {
      const nested = findNodeChildren(node.children, path);
      if (nested) return nested;
    }
  }
  return undefined;
}
