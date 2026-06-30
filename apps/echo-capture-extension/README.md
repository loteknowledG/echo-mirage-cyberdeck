# Echo Capture (Chrome extension)

Browser tab capture drone for **Echo Mirage** — best for HackerRank, LeetCode, CodeSignal, and other in-browser coding tests.

## Install (developer / unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `apps/echo-capture-extension`

## Pair with Mirage

1. On the **Mirage** machine: Spy → hub → **Echo QR**
2. Copy the QR link (capture pair URL)
3. Click the **Echo Capture** extension icon
4. Paste the URL → **Pair & arm**

## Test

With a coding test tab active, click **Test tab capture** — you should see that tab only (not the whole desktop).

## When to use which drone

| Tool | Use for |
|------|---------|
| **Echo Capture** (this extension) | Browser coding tests |
| **Echo Satellite** (desktop `.pkg`) | Zoom / Teams / Meet, chat code, any app on screen |

Both connect to the same Mirage capture-deck relay after pairing from Echo QR.

## Permissions

- **activeTab** — capture the visible browser tab on mission
- **host permissions** — pair with Mirage on your LAN and send captures to ingest URL

Audio is not supported (screenshot only).
