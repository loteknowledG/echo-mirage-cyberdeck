const PI_COMPOSER_MIN_HEIGHT_PX = 44;

/** Snap Pi message-editor textarea to one line when empty (startup flex stretch). */
export function normalizePiComposerHeight(root: ParentNode | null | undefined): void {
  if (!root) return;
  const textarea = root.querySelector<HTMLTextAreaElement>("message-editor textarea");
  if (!textarea) return;

  if (!textarea.value.trim()) {
    textarea.style.height = `${PI_COMPOSER_MIN_HEIGHT_PX}px`;
    textarea.style.minHeight = `${PI_COMPOSER_MIN_HEIGHT_PX}px`;
    textarea.style.maxHeight = `${PI_COMPOSER_MIN_HEIGHT_PX}px`;
    return;
  }

  textarea.style.maxHeight = "200px";
  textarea.style.minHeight = `${PI_COMPOSER_MIN_HEIGHT_PX}px`;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(
    Math.max(textarea.scrollHeight, PI_COMPOSER_MIN_HEIGHT_PX),
    200,
  )}px`;
}

export function schedulePiComposerHeightSync(
  root: HTMLElement | null | undefined,
  delayMs = 0,
): () => void {
  if (!root) return () => {};
  let timeoutId = 0;
  let frameId = 0;

  const run = () => {
    window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => normalizePiComposerHeight(root));
  };

  run();
  if (delayMs > 0) {
    timeoutId = window.setTimeout(run, delayMs);
  }

  return () => {
    window.clearTimeout(timeoutId);
    window.cancelAnimationFrame(frameId);
  };
}
