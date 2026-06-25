/** Agent-mode direct desktop embodiment via samus-manus hands-eyes (local Windows pyautogui). */
export const SAMUS_HANDS_EYES_DOCTRINE =
  "\n\nSAMUS-MANUS HANDS-EYES (Agent direct embodiment):" +
  "\n- Use samus_hands_eyes for local Windows desktop control (mouse, keyboard, screenshot, find-click) — you execute directly, do NOT delegate to Pi." +
  "\n- Screenshot first when navigating unknown UI; read stdout for coordinates and results." +
  "\n- For ASCII art in the glyph pane use [GLYPH:…] — not Paint/desktop unless the operator explicitly asks for a desktop app." +
  "\n- For in-deck web browsing use operator_browser; for repo files use localfs/suggest_operator_edit." +
  "\n- Pi delegation is Commander-only during ACTIVE missions.";

export function buildSamusHandsEyesDoctrine(enabled: boolean): string {
  return enabled ? SAMUS_HANDS_EYES_DOCTRINE : "";
}
