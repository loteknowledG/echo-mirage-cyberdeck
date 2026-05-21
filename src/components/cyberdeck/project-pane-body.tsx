'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { useDeckSignal } from "@/lib/cyberdeck/signal-router";
import { CyberdeckPaneHeader, CyberdeckPaneHeaderSubtitle, CyberdeckPaneHeaderTitle } from "@/components/cyberdeck/pane-header";
import { LuChevronRight, LuChevronDown, LuFolder, LuFile, LuX, LuFolderPlus } from "react-icons/lu";

type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder";
  children?: TreeNode[];
};

type ProjectPaneBodyProps = {
  workspaceRoots: { name: string; handle: FileSystemDirectoryHandle }[];
  onAddRoot: (root: { name: string; handle: FileSystemDirectoryHandle }) => void;
  onRemoveRoot: (name: string) => void;
};

export function ProjectPaneBody({ workspaceRoots, onAddRoot, onRemoveRoot }: ProjectPaneBodyProps) {
  const [tree, setTree] = useState<Record<string, TreeNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPicking, setIsPicking] = useState(false);
  const isPickingRef = useRef(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  // Listen for signals from Muthur to toggle folders
  useDeckSignal((signal) => {
    if (signal.source === "muthur" && signal.type === "project-folder-toggle") {
      const folderName = signal.payload?.folderName as string;
      if (folderName && workspaceRoots.some(r => r.name === folderName)) {
        // Toggle the root folder
        if (expanded.has(folderName)) {
          setExpanded((prev) => { const n = new Set(prev); n.delete(folderName); return n; });
        } else {
          setExpanded((prev) => { const n = new Set(prev); n.add(folderName); return n; });
        }
      }
    }
  });

  const loadRootFolder = useCallback(async (name: string, handle: FileSystemDirectoryHandle) => {
    try {
      const nodes: TreeNode[] = [];
      const iter = (handle as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries();
      let result = await iter.next();
      while (!result.done) {
        const [entryName, entryHandle] = result.value;
        const entryPath = `${name}/${entryName}`;
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
      setTree((prev) => ({ ...prev, [name]: nodes }));
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(name);
        return next;
      });
    } catch (e) {
      console.error("Failed to load folder:", e);
    }
  }, []);

  useEffect(() => {
    workspaceRoots.forEach(root => {
      if (!tree[root.name]) {
        loadRootFolder(root.name, root.handle);
      }
    });
  }, [workspaceRoots, loadRootFolder]);

  const handleAddFolder = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    setIsPicking(true);
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      onAddRoot({ name: dirHandle.name || "folder", handle: dirHandle });
    } catch (e) {
      console.error("Error picking folder:", e);
    } finally {
      isPickingRef.current = false;
      setIsPicking(false);
    }
  }, [onAddRoot]);

  const handleRemove = useCallback((name: string) => {
    onRemoveRoot(name);
    setTree((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }, [onRemoveRoot]);

  const handleToggleFolder = useCallback(async (rootName: string, path: string) => {
    const root = workspaceRoots.find(r => r.name === rootName);
    const handle = root?.handle;
    if (!handle) return;

    const parts = path.split("/").slice(1);
    let current: FileSystemDirectoryHandle = handle;

    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part);
      } catch {
        return;
      }
    }

    if (expanded.has(path)) {
      setExpanded((prev) => { const n = new Set(prev); n.delete(path); return n; });
    } else {
      const nodes: TreeNode[] = [];
      const iter = (current as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries();
      let result = await iter.next();
      while (!result.done) {
        const [entryName, entryHandle] = result.value;
        const entryPath = `${path}/${entryName}`;
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

      setExpanded((prev) => { const n = new Set(prev); n.add(path); return n; });
      setTree((prev) => {
        const folderNodes = prev[rootName] || [];
        const updateNodes = (ns: TreeNode[]): TreeNode[] => ns.map((n) => {
          if (n.path === path) return { ...n, children: nodes };
          if (n.children) return { ...n, children: updateNodes(n.children) };
          return n;
        });
        return { ...prev, [rootName]: updateNodes(folderNodes) };
      });
    }
  }, [expanded, workspaceRoots]);

  const handleSelectFile = useCallback(async (rootName: string, path: string) => {
    const root = workspaceRoots.find(r => r.name === rootName);
    const handle = root?.handle;
    if (!handle) return;

    setSelectedPath(path);
    setLoadingFile(true);

    try {
      const parts = path.split("/").slice(1);
      let current: FileSystemDirectoryHandle = handle;

      for (let i = 0; i < parts.length - 1; i++) {
        current = await current.getDirectoryHandle(parts[i]);
      }

      const fileName = parts[parts.length - 1];
      const fileHandle = await current.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      setFileContent(content);
    } catch {
      setFileContent(null);
    } finally {
      setLoadingFile(false);
    }
  }, [workspaceRoots]);

  const renderTree = useCallback((nodes: TreeNode[], depth: number, rootName: string) => {
    return nodes.map((node) => {
      const isExpanded = expanded.has(node.path);
      const isSelected = selectedPath === node.path;
      const paddingLeft = depth * 12;

      return (
        <div key={node.path}>
          <div
            className={`flex cursor-pointer items-center gap-1 px-1 py-0.5 hover:bg-[#151515] ${isSelected ? "text-emerald-400" : "text-[#888]"}`}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => node.kind === "folder" ? handleToggleFolder(rootName, node.path) : handleSelectFile(rootName, node.path)}
          >
            {node.kind === "folder" ? (
              isExpanded ? <LuChevronDown size={10} /> : <LuChevronRight size={10} />
            ) : (
              <span className="w-2.5" />
            )}
            {node.kind === "folder" ? <LuFolder size={10} className="text-yellow-600" /> : <LuFile size={10} className="text-blue-400" />}
            <span className="truncate text-[10px]">{node.name}</span>
          </div>
          {node.kind === "folder" && isExpanded && node.children && (
            renderTree(node.children, depth + 1, rootName)
          )}
        </div>
      );
    });
  }, [expanded, selectedPath, handleToggleFolder, handleSelectFile]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-black">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-56 flex-shrink-0 flex-col border-r border-[#1a1a1a] bg-black">
          <div className="border-b border-[#1a1a1a] p-2">
            <button
              type="button"
              onClick={handleAddFolder}
              disabled={isPicking}
              className="flex w-full items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1.5 text-[10px] text-[#666] hover:border-emerald-600/50 hover:text-emerald-400 disabled:opacity-40"
            >
              <LuFolderPlus size={11} />
              {isPicking ? "PICKING..." : "ADD FOLDER"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {workspaceRoots.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] text-[#444]">
                Click ADD FOLDER to open a project
              </div>
            ) : (
              workspaceRoots.map((root) => (
                <div key={root.name}>
                  <div
                    className="flex cursor-pointer items-center gap-1 px-2 py-1 hover:bg-[#111]"
                    onClick={() => handleToggleFolder(root.name, root.name)}
                  >
                    {expanded.has(root.name) ? (
                      <LuChevronDown size={10} className="text-[#555]" />
                    ) : (
                      <LuChevronRight size={10} className="text-[#555]" />
                    )}
                    <LuFolder size={10} className="text-yellow-600" />
                    <span className="flex- truncate text-[10px] text-[#999]">{root.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(root.name)}
                      className="text-[#444] hover:text-red-400"
                    >
                      <LuX size={10} />
                    </button>
                  </div>
                  {expanded.has(root.name) && tree[root.name] && (
                    <div>{renderTree(tree[root.name], 1, root.name)}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#080808] p-3">
          {loadingFile ? (
            <div className="text-[10px] text-[#444]">LOADING...</div>
          ) : selectedPath ? (
            fileContent !== null ? (
              <pre className="whitespace-pre-wrap text-[10px] text-[#aaa]">{fileContent}</pre>
            ) : (
              <div className="text-[10px] text-[#444]">CANNOT READ FILE</div>
            )
          ) : (
            <div className="text-[10px] text-[#444]">SELECT A FILE TO PREVIEW</div>
          )}
        </div>
      </div>
    </div>
  );
}