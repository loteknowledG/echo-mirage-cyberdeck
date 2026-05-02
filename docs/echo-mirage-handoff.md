# Echo Mirage Handoff

Use this note to resume the current thread in a fresh session.

## Session Goal
Keep Echo Mirage responsive and layout-driven. Prefer CSS/layout fixes over measuring scripts whenever possible.

## Current State
- Chat history, streaming text, input draft, active tab, and focus posture persist across refresh.
- Voice uses a working copy with master restore.
- MUTHUR memory is active in Settings.
- Operator supports load, edit, save, copy, paste, and image preview.
- Heap exists as a local stash.
- Settings uses square-card grids for voice and memory.
- The active tab label sits on the Echo/left header near the rail.
- The splitter is visible, draggable, and can reset on double-click.
- The chat pane follows the resizable layout, and the composer stays attached to the bottom of the chat pane.

## Layout Rules
- The chat pane should resize before the composer gets pushed away.
- The composer should stay in normal flow inside the chat pane.
- On mobile, use layout first, not scripts, so the composer remains visible.
- Preserve the chat scrollbar.

## Next Check
1. Open the app in a fresh session.
2. Verify the splitter is visible and easy to grab.
3. Verify the chat pane and composer move together when the divider changes.
4. Verify the right pane can still collapse away cleanly.
5. Verify the deck feels responsive on mobile and desktop.

## Suggested Prompt For The Next Session
"Resume Echo Mirage. The responsive layout is already in place. Please verify the splitter, chat pane, and composer behavior in mobile and desktop, then tune any remaining issues without adding measurement scripts."

## Related Docs
- [Archive Design](./archive-design.md)
- [Project Group Init](./project-group-init.md)
- [Memory Spec](./echo-mirage-memory-spec.md)
- [MUTHUR Voice](./MUTHUR_VOICE.md)
