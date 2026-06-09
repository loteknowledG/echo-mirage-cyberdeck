/** Scale rendered docx-preview page to fit the operator pane without squashing inline layout. */
export function fitOperatorDocxPreview(bodyEl: HTMLElement | null): void {
  if (!bodyEl) return;

  const wrapper = bodyEl.querySelector<HTMLElement>(".operator-docx-preview-wrapper");
  const section = bodyEl.querySelector<HTMLElement>("section.operator-docx-preview");
  if (!wrapper || !section) return;

  section.style.transform = "";
  section.style.transformOrigin = "";
  wrapper.style.minHeight = "";
  wrapper.style.width = "";

  const pad = 8;
  const available = Math.max(0, bodyEl.clientWidth - pad);
  const naturalWidth = section.getBoundingClientRect().width;
  if (available <= 0 || naturalWidth <= 0) return;

  wrapper.style.width = "100%";

  if (naturalWidth <= available) return;

  const scale = available / naturalWidth;
  section.style.transform = `scale(${scale})`;
  section.style.transformOrigin = "top center";
  wrapper.style.minHeight = `${Math.ceil(section.getBoundingClientRect().height * scale)}px`;
}

/** docx-preview recalculates tab stops ~500ms after render; fit after that settles. */
export function scheduleOperatorDocxPreviewFit(
  bodyEl: HTMLElement | null,
  delayMs = 550,
): () => void {
  if (!bodyEl) return () => {};
  let inner = 0;
  let outer = 0;

  const run = () => {
    window.cancelAnimationFrame(inner);
    inner = window.requestAnimationFrame(() => fitOperatorDocxPreview(bodyEl));
  };

  outer = window.setTimeout(run, delayMs);
  run();

  return () => {
    window.clearTimeout(outer);
    window.cancelAnimationFrame(inner);
  };
}
