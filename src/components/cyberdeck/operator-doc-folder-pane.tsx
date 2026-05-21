'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuChevronDown,
  LuChevronRight,
  LuFile,
  LuFolder,
  LuFolderPlus,
  LuX,
} from "react-icons/lu";
import {
  listDirectoryChildren,
  mergeFolderTreeNodes,
  readFileFromFolderPath,
  type OperatorFolderTreeNode,
} from "@/lib/operator-folder-nav";

type OperatorDocFolderRoot = {
  name: string;
  handle: FileSystemDirectoryHandle;
};

type OperatorDocFolderPaneProps = {
  onOpenFile: (file: File) => void | Promise<void>;
};

export function OperatorDocFolderPane({ onOpenFile }: OperatorDocFolderPaneProps) {
  const [roots, setRoots] = useState<OperatorDocFolderRoot[]>([]);
  const [tree, setTree] = useState<Record<string, OperatorFolderTreeNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const isPickingRef = useRef(false);

  const loadRootFolder = useCallback(async (name: string, handle: FileSystemDirectoryHandle) => {
    try {
      const nodes = await listDirectoryChildren(handle, name);
      setTree((prev) => ({ ...prev, [name]: nodes }));
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(name);
        return next;
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    roots.forEach((root) => {
      if (!tree[root.name]) {
        void loadRootFolder(root.name, root.handle);
      }
    });
  }, [roots, tree, loadRootFolder]);

  const handleAddFolder = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setIsPicking(true);
    try {
      const picker = (window as Window & {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      if (typeof picker !== "function") return;
      const dirHandle = await picker();
      const name = dirHandle.name || "folder";
      if (roots.some((root) => root.name === name)) return;
      setRoots((prev) => [...prev, { name, handle: dirHandle }]);
    } catch {
      /* canceled or unavailable */
    } finally {
      isPickingRef.current = false;
      setIsPicking(false);
    }
  }, [roots]);

  const handleRemoveRoot = useCallback((name: string) => {
    setRoots((prev) => prev.filter((root) => root.name !== name));
    setTree((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const path of prev) {
        if (path === name || path.startsWith(`${name}/`)) next.delete(path);
      }
      return next;
    });
    if (selectedPath?.startsWith(name)) setSelectedPath(null);
  }, [selectedPath]);

  const handleToggleFolder = useCallback(
    async (rootName: string, path: string) => {
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

      const parts = path.split("/").slice(1);
      let current = root.handle;
      for (const part of parts) {
        try {
          current = await current.getDirectoryHandle(part);
        } catch {
          return;
        }
      }

      const nodes = await listDirectoryChildren(current, path);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(path);
        return next;
      });
      setTree((prev) => ({
        ...prev,
        [rootName]: mergeFolderTreeNodes(prev[rootName] || [], path, nodes),
      }));
    },
    [expanded, roots],
  );

  const handleSelectFile = useCallback(
    async (rootName: string, path: string) => {
      const root = roots.find((entry) => entry.name === rootName);
      if (!root) return;

      setSelectedPath(path);
      setOpeningPath(path);
      try {
        const file = await readFileFromFolderPath(root.handle, path);
        if (file) await onOpenFile(file);
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

        return (
          <div key={node.path}>
            <button
              type="button"
              className={`flex w-full cursor-pointer items-center gap-1 px-1 py-0.5 text-left hover:bg-[#151515] ${
                isSelected ? "text-emerald-400" : "text-[#888]"
              }`}
              style={{ paddingLeft: `${depth * 12}px` }}
              onClick={() =>
                node.kind === "folder"
                  ? void handleToggleFolder(rootName, node.path)
                  : void handleSelectFile(rootName, node.path)
              }
            >
              {node.kind === "folder" ? (
                isExpanded ? <LuChevronDown size={10} /> : <LuChevronRight size={10} />
              ) : (
                <span className="w-2.5" />
              )}
              {node.kind === "folder" ? (
                <LuFolder size={10} className="shrink-0 text-yellow-600" />
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
    [expanded, handleSelectFile, handleToggleFolder, openingPath, selectedPath],
  );

  return (
    <aside className="flex w-44 shrink-0 flex-col border-l border-[#1c1c1c] bg-black">
      <div className="border-b border-[#1c1c1c] p-2">
        <button
          type="button"
          onClick={() => void handleAddFolder()}
          disabled={isPicking}
          className="flex w-full items-center gap-1.5 rounded border border-[#2d2d2d] bg-black px-2 py-1.5 font-mono text-[9px] tracking-[0.06em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:opacity-40"
        >
          <LuFolderPlus size={11} />
          {isPicking ? "PICKING…" : "ADD FOLDER"}
        </button>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto py-1">
        {roots.length === 0 ? (
          <div className="px-3 py-4 text-center font-mono text-[9px] tracking-[0.06em] text-[#5a5a5a]">
            ADD FOLDER TO BROWSE DOCS
          </div>
        ) : (
          roots.map((root) => (
            <div key={root.name}>
              <div className="flex items-center gap-1 px-2 py-1 hover:bg-[#111]">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 text-left"
                  onClick={() => void handleToggleFolder(root.name, root.name)}
                >
                  {expanded.has(root.name) ? (
                    <LuChevronDown size={10} className="shrink-0 text-[#555]" />
                  ) : (
                    <LuChevronRight size={10} className="shrink-0 text-[#555]" />
                  )}
                  <LuFolder size={10} className="shrink-0 text-yellow-600" />
                  <span className="truncate font-mono text-[10px] text-[#999]">{root.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveRoot(root.name)}
                  className="shrink-0 text-[#444] transition hover:text-red-400"
                  aria-label={`Remove folder ${root.name}`}
                >
                  <LuX size={10} />
                </button>
              </div>
              {expanded.has(root.name) && tree[root.name] ? (
                <div>{renderTree(tree[root.name], 1, root.name)}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
