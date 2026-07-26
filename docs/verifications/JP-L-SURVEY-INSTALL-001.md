# JP-L-SURVEY-INSTALL-001 — Consolidate Installation into Survey

## Status

Implementation complete; final verification pending.

## Capability Disposition

| Previous Install capability | Disposition | Destination |
|---|---|---|
| Full desktop installer lookup and download | `KEEP_OPTIONAL_DESKTOP` | Survey → Mirage |
| Desktop-shell explanation | `MOVE_TO_SURVEY` | Survey setup language |
| Desktop shell active state | `ALREADY_IN_SURVEY` | Survey shell badge and setup panel |
| Echo Satellite installer | `ALREADY_IN_SURVEY` | Survey → Echo |
| PWA installation | `ALREADY_IN_SURVEY` | Survey setup panel |
| Pairing and team state | `ALREADY_IN_SURVEY` | Survey hub and team status |
| Update behavior | `KEEP_OPTIONAL_DESKTOP` | Settings and existing desktop updater |
| Installer API and release utilities | `KEEP_OPTIONAL_DESKTOP` | Shared Electron install utilities |
| Dedicated Install rail tab and icon | `REMOVE_DEAD` | Legacy tabs migrate to Survey |

## Architecture Result

* Survey is the canonical Echo Satellite lifecycle surface.
* Hosted Mirage is described as installation-free.
* The full desktop Cyberdeck remains discoverable as an optional offline,
  self-hosted, development, and local-disk distribution.
* Installer APIs, packaging, updater infrastructure, and shared utilities remain
  intact.
* No localhost, pairing, capture, or authorization boundary was changed.

## Compatibility

Legacy custom-tab kinds `install`, `install-desktop`, `install_desktop`, and
`desktop-install` normalize to `survey`. During workspace hydration they retain
their tab identity while receiving the Survey label, glyph, and pane.

## Removed Surface

* automatic Install-tab injection for non-Electron sessions
* Install custom-tab creation action
* Install pane registry entry and chunk
* Install pane body
* Install rail icon

## Verification

Final command results will be recorded here after execution.
