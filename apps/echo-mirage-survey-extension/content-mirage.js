/** Runs on Echo Mirage cyberdeck tabs — bridges extension → page CustomEvent. */
const SURVEY_EXTENSION_PAGE_CONTEXT_EVENT = "echo-mirage:survey-extension-page-context";

function deliverPayloadToPage(payload) {
  const script = document.createElement("script");
  script.textContent = `(function(){
    window.dispatchEvent(new CustomEvent(${JSON.stringify(SURVEY_EXTENSION_PAGE_CONTEXT_EVENT)}, {
      detail: ${JSON.stringify(payload)}
    }));
  })();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
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
