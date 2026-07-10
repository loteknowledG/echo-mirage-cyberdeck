/** Runs on mirage-browser cyberdeck tabs — bridges echo-extension → page via postMessage. */
const SURVEY_EXTENSION_PAGE_CONTEXT_MESSAGE_TYPE = "echo-mirage:survey-extension-page-context";

function deliverPayloadToPage(payload) {
  window.postMessage(
    {
      source: "echo-extension",
      type: SURVEY_EXTENSION_PAGE_CONTEXT_MESSAGE_TYPE,
      payload,
    },
    window.location.origin,
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SURVEY_EXTENSION_DELIVER") return;
  const payload = message.payload;
  if (!payload || typeof payload.url !== "string") {
    sendResponse({ ok: false, reason: "Invalid page context payload." });
    return;
  }

  try {
    deliverPayloadToPage(payload);
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({
      ok: false,
      reason: err instanceof Error ? err.message : "Failed to deliver to cyberdeck page.",
    });
  }
  return true;
});
