/** Runs on Echo Mirage cyberdeck tabs — bridges extension → page CustomEvent. */
const SURVEY_EXTENSION_PAGE_CONTEXT_EVENT = "echo-mirage:survey-extension-page-context";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SURVEY_EXTENSION_DELIVER") return;
  const payload = message.payload;
  if (!payload || typeof payload.url !== "string") {
    sendResponse({ ok: false, reason: "Invalid page context payload." });
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SURVEY_EXTENSION_PAGE_CONTEXT_EVENT, { detail: payload }),
  );
  sendResponse({ ok: true });
  return true;
});
