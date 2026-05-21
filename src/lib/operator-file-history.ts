/** Push a path onto file history (trim forward stack). Returns null if unchanged. */
export function pushOperatorFileHistory(
  history: string[],
  historyIndex: number,
  path: string,
  activePath: string | null,
): { history: string[]; historyIndex: number } | null {
  if (path === activePath) return null;

  const trimmed = historyIndex >= 0 ? history.slice(0, historyIndex + 1) : [];
  if (trimmed[trimmed.length - 1] === path) {
    return { history: trimmed, historyIndex: trimmed.length - 1 };
  }

  const next = [...trimmed, path];
  return { history: next, historyIndex: next.length - 1 };
}

export function canNavigateOperatorFileBack(historyIndex: number): boolean {
  return historyIndex > 0;
}

export function canNavigateOperatorFileForward(
  history: string[],
  historyIndex: number,
): boolean {
  return historyIndex >= 0 && historyIndex < history.length - 1;
}

export function operatorFileHistoryBackIndex(historyIndex: number): number | null {
  if (historyIndex <= 0) return null;
  return historyIndex - 1;
}

export function operatorFileHistoryForwardIndex(
  history: string[],
  historyIndex: number,
): number | null {
  if (!canNavigateOperatorFileForward(history, historyIndex)) return null;
  return historyIndex + 1;
}
