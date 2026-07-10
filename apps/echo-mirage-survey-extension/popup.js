const sendButton = document.getElementById("send");
const statusEl = document.getElementById("status");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

sendButton?.addEventListener("click", async () => {
  sendButton.disabled = true;
  setStatus("Capturing active tab…");
  try {
    const result = await chrome.runtime.sendMessage({ type: "SURVEY_EXTENSION_CAPTURE_ACTIVE" });
    if (!result?.ok) {
      setStatus(result?.reason ?? "Delivery failed.", true);
      return;
    }
    const title = result.title ? ` · ${result.title.slice(0, 48)}` : "";
    setStatus(
      `Sent to cyberdeck (${result.delivered}/${result.mirageTabs})${title}. Switch to the Echo Mirage tab — green toast is bottom-right there.`,
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Extension error.", true);
  } finally {
    sendButton.disabled = false;
  }
});
