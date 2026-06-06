'use client';

import { type ChangeEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cdxIconAdd,
  cdxIconClose,
  cdxIconCollapse,
  cdxIconExpand,
  cdxIconReload,
} from "@wikimedia/codex-icons";
import {
  CyberdeckControl,
  CyberdeckMenuButton,
} from "@/components/cyberdeck/cyberdeck-control-button";
import { isOperatorBinaryPreviewPath } from "@/lib/operator-binary-preview";
import { operatorFileIcon, operatorFolderIcon, operatorIconSrc } from "@/lib/operator-file-icon";
import { cn } from "@/lib/utils";
import { CodexIcon } from "@/components/codex-icon";
import {
  listDirectoryChildrenForRoot,
  mergeFolderTreeNodes,
  readFileFromFolderRoot,
  type OperatorDocFolderRoot,
  type OperatorFolderTreeNode,
} from "@/lib/operator-folder-nav";
import {
  buildOperatorFolderSnapshot,
  supportsFileSystemDirectoryPicker,
  supportsWebkitDirectoryInput,
} from "@/lib/operator-folder-snapshot";

type OperatorDocFolderPaneProps = {
  onOpenFile: (path: string, file: File) => void | Promise<void>;
  onRootsChange?: (roots: OperatorDocFolderRoot[]) => void;
  className?: string;
};

type FolderContextMenu = {
  x: number;
  y: number;
  copyPath: string;
  refreshPath: string;
  rootName: string;
  kind: "file" | "folder";
};

const OPERATOR_FOLDER_STATE_STORAGE_KEY = "echo-mirage-operator-folder-pane-state-v1";

type PersistedFolderRoot = {
  id: string;
  name: string;
  diskPath: string;
};

type PersistedFolderState = {
  roots?: PersistedFolderRoot[];
  expanded?: string[];
  selectedPath?: string | null;
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

function createRootFromSnapshot(
  label: string,
  snapshot: NonNullable<OperatorDocFolderRoot["snapshot"]>,
): OperatorDocFolderRoot {
  return {
    id: crypto.randomUUID(),
    name: label,
    snapshot,
  };
}

function copiedTreePath(root: OperatorDocFolderRoot, logicalPath: string): string {
  if (!root.diskPath) return logicalPath;
  const relativePath =
    logicalPath === root.name ? "" : logicalPath.startsWith(`${root.name}/`) ? logicalPath.slice(root.name.length + 1) : logicalPath;
  if (!relativePath) return root.diskPath;
  const separator = root.diskPath.includes("\\") ? "\\" : "/";
  return `${root.diskPath.replace(/[\\/]+$/, "")}${separator}${relativePath.replaceAll("/", separator)}`;
}

function parentLogicalPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index > -1 ? path.slice(0, index) : path;
}

async function writeTreePathToClipboard(path: string): Promise<void> {
  if (window.echoMirageClipboard?.writeText) {
    await window.echoMirageClipboard.writeText(path);
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(path);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = path;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.left = "-9999px";
  document.body.appendChild(fallback);
  fallback.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Clipboard copy was not accepted.");
  } finally {
    fallback.remove();
  }
}

function readPersistedFolderState(): PersistedFolderState | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OPERATOR_FOLDER_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedFolderState | null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistFolderState(state: PersistedFolderState): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    window.localStorage.setItem(OPERATOR_FOLDER_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage failures */
  }
}

function OperatorTreeIcon({
  name,
  kind,
  expanded = false,
  root = false,
  muted = false,
}: {
  name: string;
  kind: "file" | "folder";
  expanded?: boolean;
  root?: boolean;
  muted?: boolean;
}) {
  const icon = kind === "file" ? operatorFileIcon(name) : operatorFolderIcon(name, expanded, root);

  return (
    <img
      src={operatorIconSrc(icon)}
      alt=""
      data-vscode-icon={icon}
      className={cn(
        "h-3 w-3 shrink-0",
        muted && "opacity-45",
      )}
    />
  );
}

export function OperatorDocFolderPane({ onOpenFile, onRootsChange, className }: OperatorDocFolderPaneProps) {
  const [roots, setRoots] = useState<OperatorDocFolderRoot[]>([]);
  const [tree, setTree] = useState<Record<string, OperatorFolderTreeNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [replacingRootId, setReplacingRootId] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FolderContextMenu | null>(null);
  const [folderStateHydrated, setFolderStateHydrated] = useState(false);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const webkitDirectoryInputRef = useRef<HTMLInputElement | null>(null);
  const isPickingRef = useRef(false);
  const didRestoreExpandedTreeRef = useRef(false);

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
    const persisted = readPersistedFolderState();
    if (!persisted) {
      setFolderStateHydrated(true);
      return;
    }

    const restoredRoots = Array.isArray(persisted.roots)
      ? persisted.roots.flatMap((root) => {
          if (!root || typeof root !== "object") return [];
          if (!root.name?.trim() || !root.diskPath?.trim()) return [];
          return [{ id: root.id || crypto.randomUUID(), name: root.name, diskPath: root.diskPath }];
        })
      : [];

    if (restoredRoots.length > 0) setRoots(restoredRoots);
    if (Array.isArray(persisted.expanded)) {
      setExpanded(new Set(persisted.expanded.filter((path) => typeof path === "string" && path.trim())));
    }
    if (typeof persisted.selectedPath === "string" && persisted.selectedPath.trim()) {
      setSelectedPath(persisted.selectedPath);
    }
    setFolderStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!folderStateHydrated) return;
    persistFolderState({
      roots: roots.flatMap((root) =>
        root.diskPath ? [{ id: root.id, name: root.name, diskPath: root.diskPath }] : [],
      ),
      expanded: [...expanded],
      selectedPath,
    });
  }, [expanded, folderStateHydrated, roots, selectedPath]);

  useEffect(() => {
    if (!folderStateHydrated || didRestoreExpandedTreeRef.current) return;
    if (roots.length === 0 || expanded.size === 0) return;

    didRestoreExpandedTreeRef.current = true;
    let cancelled = false;

    void (async () => {
      const paths = [...expanded].sort((a, b) => a.split("/").length - b.split("/").length);
      for (const path of paths) {
        if (cancelled) return;
        const rootName = path.split("/")[0];
        const root = roots.find((entry) => entry.name === rootName);
        if (!root?.diskPath && !root?.snapshot) continue;
        setPathLoading(path, true);
        try {
          const nodes = await listDirectoryChildrenForRoot(root, path);
          if (cancelled) return;
          setTree((prev) => ({
            ...prev,
            [rootName]:
              path === rootName ? nodes : mergeFolderTreeNodes(prev[rootName] || [], path, nodes),
          }));
        } catch {
          /* Ignore stale persisted paths; operator can refresh or re-open. */
        } finally {
          if (!cancelled) setPathLoading(path, false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expanded, folderStateHydrated, roots, setPathLoading]);

  useEffect(() => {
    onRootsChange?.(roots);
  }, [onRootsChange, roots]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const openContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>, root: OperatorDocFolderRoot, path: string, kind: "file" | "folder") => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        copyPath: copiedTreePath(root, path),
        refreshPath: kind === "folder" ? path : parentLogicalPath(path),
        rootName: root.name,
        kind,
      });
    },
    [],
  );

  const copyContextMenuPath = useCallback(async () => {
    if (!contextMenu) return;
    const path = contextMenu.copyPath;
    const kind = contextMenu.kind;
    setContextMenu(null);
    try {
      await writeTreePathToClipboard(path);
      toast.success(`Copied ${kind} path: ${path}`);
    } catch {
      toast.error("Could not copy path.");
    }
  }, [contextMenu]);

  const refreshContextMenuFolder = useCallback(async () => {
    if (!contextMenu) return;
    const { refreshPath, rootName } = contextMenu;
    const root = roots.find((entry) => entry.name === rootName);
    setContextMenu(null);
    if (!root) return;

    const scrollTop = treeScrollRef.current?.scrollTop ?? 0;
    setPathLoading(refreshPath, true);
    try {
      const nodes = await listDirectoryChildrenForRoot(root, refreshPath);
      setTree((prev) => ({
        ...prev,
        [rootName]:
          refreshPath === rootName
            ? nodes
            : mergeFolderTreeNodes(prev[rootName] || [], refreshPath, nodes),
      }));
      window.requestAnimationFrame(() => {
        if (treeScrollRef.current) treeScrollRef.current.scrollTop = scrollTop;
      });
      toast.success(`Refreshed ${refreshPath}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not refresh ${refreshPath}.`);
    } finally {
      setPathLoading(refreshPath, false);
    }
  }, [contextMenu, roots, setPathLoading]);

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

    if (supportsFileSystemDirectoryPicker()) {
      const picker = (
        window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker;
      const dirHandle = await picker!();
      const baseName = dirHandle.name || "folder";
      return createRootFromHandle(dirHandle, baseName);
    }

    return null;
  }, []);

  const addSnapshotRoot = useCallback((files: File[]) => {
    const provisional = buildOperatorFolderSnapshot(files);
    if (!provisional) {
      toast.error("No files were found in the selected folder.");
      return;
    }

    setRoots((prev) => {
      const label = uniqueRootLabel(provisional.rootSegment, prev.map((root) => root.name));
      const built =
        label === provisional.rootSegment
          ? provisional
          : buildOperatorFolderSnapshot(files, label);
      if (!built) return prev;

      const root = createRootFromSnapshot(label, built.snapshot);
      setTree((treePrev) => ({
        ...treePrev,
        [label]: built.snapshot.childrenByDirPath.get(label) ?? [],
      }));
      setExpanded((expandedPrev) => new Set(expandedPrev).add(label));
      return [...prev, root];
    });
    toast.success("Folder added. Tap folders in the tree to expand.");
  }, []);

  const openWebkitDirectoryPicker = useCallback(() => {
    const input = webkitDirectoryInputRef.current;
    if (!input) {
      toast.error("Folder picker is not available in this browser.");
      return;
    }
    input.value = "";
    input.click();
  }, []);

  const handleWebkitDirectoryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      isPickingRef.current = false;
      setIsPicking(false);
      const fileList = event.target.files;
      event.target.value = "";
      if (!fileList?.length) return;
      addSnapshotRoot([...fileList]);
    },
    [addSnapshotRoot],
  );

  const handleAddFolder = useCallback(async () => {
    if (isPickingRef.current) return;

    const bridge = window.echoMirageOpen;
    const useWebkitFirst =
      !bridge?.pickOperatorFolder &&
      !supportsFileSystemDirectoryPicker() &&
      supportsWebkitDirectoryInput();

    if (useWebkitFirst) {
      isPickingRef.current = true;
      setIsPicking(true);
      openWebkitDirectoryPicker();
      return;
    }

    isPickingRef.current = true;
    setIsPicking(true);
    try {
      const picked = await pickDirectoryRoot();
      if (!picked) {
        if (supportsWebkitDirectoryInput()) {
          openWebkitDirectoryPicker();
          return;
        }
        toast.error(
          "Folder picker is not available here. Use the Echo Mirage desktop app, or Chrome/Edge on desktop.",
        );
        return;
      }

      setRoots((prev) => {
        const label = uniqueRootLabel(picked.name, prev.map((root) => root.name));
        return [...prev, { ...picked, name: label }];
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        isPickingRef.current = false;
        setIsPicking(false);
        return;
      }
      if (supportsWebkitDirectoryInput()) {
        openWebkitDirectoryPicker();
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not add folder.");
    } finally {
      if (!supportsWebkitDirectoryInput() || window.echoMirageOpen?.pickOperatorFolder) {
        isPickingRef.current = false;
        setIsPicking(false);
      }
    }
  }, [openWebkitDirectoryPicker, pickDirectoryRoot]);

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
        const read = await readFileFromFolderRoot(root, path);
        if (read) await onOpenFile(path, read.file);
        else if (isOperatorBinaryPreviewPath(path)) {
          toast.error(
            "Could not read this file as binary. Restart the Echo Mirage desktop app and try again.",
          );
        } else {
          toast.error("Could not read file.");
        }
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
              onContextMenu={(event) => {
                const root = roots.find((entry) => entry.name === rootName);
                if (root) openContextMenu(event, root, node.path, node.kind);
              }}
            >
              {node.kind === "folder" ? (
                isLoading ? (
                  <span className="w-2.5 animate-pulse text-[#555]">…</span>
                ) : isExpanded ? (
                  <CodexIcon icon={cdxIconCollapse} className="h-2.5 w-2.5" />
                ) : (
                  <CodexIcon icon={cdxIconExpand} className="h-2.5 w-2.5" />
                )
              ) : (
                <span className="w-2.5" />
              )}
              {node.kind === "folder" ? (
                <OperatorTreeIcon name={node.name} kind="folder" expanded={isExpanded} muted={node.ignored} />
              ) : (
                <OperatorTreeIcon name={node.name} kind="file" />
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
    [expanded, handleSelectFile, handleToggleFolder, loadingPaths, openContextMenu, openingPath, roots, selectedPath],
  );

  return (
    <aside
      className={cn("flex h-full min-w-0 flex-col bg-black", className)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <input
        ref={webkitDirectoryInputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        multiple
        // @ts-expect-error — non-standard directory picker attributes (mobile Safari / Chrome)
        webkitdirectory=""
        directory=""
        onChange={handleWebkitDirectoryChange}
        onCancel={() => {
          isPickingRef.current = false;
          setIsPicking(false);
        }}
      />
      <div className="border-b border-[#1c1c1c] p-2">
        <CyberdeckControl
          control={{ size: "wide" }}
          onClick={() => void handleAddFolder()}
          disabled={isPicking}
          className="w-full"
        >
          <CodexIcon icon={cdxIconAdd} className="h-3 w-3 shrink-0" />
          {isPicking && !replacingRootId ? "PICKING…" : "ADD FOLDER"}
        </CyberdeckControl>
      </div>
      <div ref={treeScrollRef} className="custom-scrollbar flex-1 overflow-y-auto py-1">
        {roots.length === 0 ? (
          <div className="px-3 py-4 text-center font-mono text-[9px] leading-snug tracking-[0.06em] text-[#5a5a5a]">
            ADD FOLDER TO BROWSE DOCS
            {supportsWebkitDirectoryInput() && !supportsFileSystemDirectoryPicker() ? (
              <span className="mt-2 block text-[#666]">
                On phone: tap ADD FOLDER, then choose a folder in Files. In-place save needs the desktop app.
              </span>
            ) : null}
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
                    onContextMenu={(event) => openContextMenu(event, root, root.name, "folder")}
                  >
                    {rootLoading || isReplacing ? (
                      <span className="w-2.5 shrink-0 animate-pulse text-[#555]">…</span>
                    ) : rootExpanded ? (
                      <CodexIcon icon={cdxIconCollapse} className="h-2.5 w-2.5 shrink-0 text-[#555]" />
                    ) : (
                      <CodexIcon icon={cdxIconExpand} className="h-2.5 w-2.5 shrink-0 text-[#555]" />
                    )}
                    <OperatorTreeIcon name={root.name} kind="folder" expanded={rootExpanded} root />
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
                    <CodexIcon icon={cdxIconReload} className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveRoot(root.id)}
                    className="shrink-0 text-[#444] transition hover:text-red-400"
                    aria-label={`Remove folder ${root.name}`}
                  >
                    <CodexIcon icon={cdxIconClose} className="h-2.5 w-2.5" />
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
      {contextMenu ? (
        <div
          role="menu"
          aria-label="Folder tree actions"
          className="fixed z-50 min-w-40 rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <CyberdeckMenuButton
            role="menuitem"
            danger={false}
            onClick={() => void copyContextMenuPath()}
          >
            {contextMenu.kind === "file" ? "COPY FILE PATH" : "COPY FOLDER PATH"}
          </CyberdeckMenuButton>
          <CyberdeckMenuButton
            role="menuitem"
            danger={false}
            onClick={() => void refreshContextMenuFolder()}
          >
            REFRESH
          </CyberdeckMenuButton>
        </div>
      ) : null}
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
