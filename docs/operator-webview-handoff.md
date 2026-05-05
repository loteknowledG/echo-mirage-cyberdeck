# Operator Webview Handoff

Date: 2026-05-04
Repo: `F:\dev\echo-mirage-cyberdeck`

## Current App State

The app is in a good working state overall.

Recent working changes:
- MUTHUR input now supports up-arrow / down-arrow message history in [`src/app/cyberdeck/page.tsx`](F:/dev/echo-mirage-cyberdeck/src/app/cyberdeck/page.tsx).
- Right-side desktop divider stop is set to `0.01`, which the user confirmed is the correct “all the way right but still draggable” feel.
- The `π` tab works again:
  - messages persist correctly
  - Pi box is aligned with MUTHUR’s message box
  - unfocused state is dim instead of brightly lit
- MUTHUR has server-side tools:
  - `justbash` for workspace inspection
  - `localfs` for real local-machine read-only inspection
  - `clock` for time/date
  - `websearch` via Tavily (requires `TAVILY_API_KEY`)

## Important User Preferences

- Make one small change at a time.
- Do not add extra “creative” changes.
- Prefer direct, minimal fixes.
- If something visually important shifts, stop and let the user inspect.
- The user is okay with reverting if things drift.

## MUTHUR Tooling Status

### Working

MUTHUR can currently:
- inspect repo files with `/bash ...`
- inspect local machine paths with `/local ...`
- infer some tool use naturally, for example:
  - `are there files that mention mu/th/ur`
  - `ls C:\dev\samus-manus`
  - `what is the time`

Files involved:
- [`src/lib/muthur-core/tool-registry.ts`](F:/dev/echo-mirage-cyberdeck/src/lib/muthur-core/tool-registry.ts)
- [`src/lib/muthur-core/loop.ts`](F:/dev/echo-mirage-cyberdeck/src/lib/muthur-core/loop.ts)
- [`src/app/api/cyberdeck-chat/route.ts`](F:/dev/echo-mirage-cyberdeck/src/app/api/cyberdeck-chat/route.ts)

### Not Yet Built

The user does **not** want hidden API-only web behavior as the long-term solution.

The desired direction is:
- MUTHUR should use the web like a person
- the user should be able to watch it happen live
- this should appear inside the Operator tab

## Next Feature Direction

The next major feature is **live web use inside the Operator tab**.

### Desired layout

Current operator layout should become:
- 1st column: MUTHUR chat
- 2nd column: live web view MUTHUR is actively using

There is **not** a 3rd column yet. Do not assume one exists.

### Desired behavior

When MUTHUR uses the web, the user wants to see:
- the actual page
- typed URL / navigation
- search results
- clicks and page changes in real time

The user specifically wants:
- real live web view, not just status text
- browser behavior visible in the Operator tab
- MUTHUR’s web actions to be observable so the user can teach her better habits

### Likely implementation direction

Because this is an Electron + Next app, the most likely clean architecture is:
- Electron-owned browser/webview on the desktop side
- surfaced into the Operator tab UI
- MUTHUR actions routed through Electron / preload / IPC
- chat can optionally narrate actions, but the live page itself is the main feature

This is better than relying only on Tavily-style hidden search for the long-term design.

## What Not To Do Next

- Do not refactor the whole Operator tab first.
- Do not add hidden web API behavior and call it “done”.
- Do not move header/tab layout around while building this.
- Do not reintroduce the old broken header / ASCII placement problems.

## Good First Step Next Session

The next safe step is:

1. inspect the current Operator tab right-pane component structure
2. identify where a live Electron webview/browser surface could mount
3. make a minimal plan for replacing the current operator right pane with a live webview

No big UI rewrite yet. Just locate the correct mounting point first.

