import { isMuthurDirectPiComputerUseEnabled } from "@/lib/muthur/control/muthur-direct-pi-computer-use";
import { isPiControlLeaseGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating";

/** L-MUTHUR-CONTROL-001 — Pi embodiment delegation doctrine (injected into MUTHUR system prompt). */
const MUTHUR_PI_CONTROL_BASE = isPiControlLeaseGatingEnabled()
  ? "\n\nPI COMPUTER USE & CONTROL LEASE (MU/TH/UR):" +
    "\n- MU (MUTHUR Uses): You select and delegate to available cadre capabilities. Pi is the preferred embodiment operator for desktop/computer-use missions (screenshot, mouse, keyboard, scroll)." +
    "\n- TH (Thread Handoff): You may request a temporary control lease for mouse/keyboard/screen. The operator must explicitly grant it via the CONTROL REQUEST UI." +
    "\n- UR (User Retake): Operator authority is absolute. They may reclaim control instantly during an active lease."
  : "\n\nPI COMPUTER USE (direct):" +
    "\n- Pi is the preferred embodiment operator for desktop/computer-use missions (screenshot, mouse, keyboard, scroll)." +
    "\n- request_pi_control_lease auto-grants control — proceed immediately to pi_computer_use or delegate_pi_computer_use." +
    "\n- The operator may still retake control from the deck UI at any time.";

const MUTHUR_PI_CONTROL_DELEGATE_FLOW = isPiControlLeaseGatingEnabled()
  ? "\n\nWhen a task requires physical or desktop interaction (draw/paint on screen, open a browser, navigate a website, upload a document, configure software, click/type/scroll on the desktop):" +
    "\n1. Determine required capability (computer use)." +
    "\n2. Select Pi as the embodiment operator — do NOT ask the operator to manually open or select the Pi tab." +
    "\n3. Call request_pi_control_lease with task title, reason, and mission summary." +
    "\n4. After grant, call delegate_pi_computer_use with the mission instructions." +
    "\n5. Monitor progress and report results in MUTHUR channel." +
    "\n6. Release is automatic when the mission completes or the operator retakes control."
  : "\n\nWhen a task requires physical or desktop interaction:" +
    "\n1. Call request_pi_control_lease (auto-grants) then delegate_pi_computer_use with mission instructions." +
    "\n2. Monitor progress and report results in the MUTHUR channel.";

const MUTHUR_PI_CONTROL_DIRECT_FLOW = isPiControlLeaseGatingEnabled()
  ? "\n\nWhen a task requires physical or desktop interaction (draw/paint on screen, open apps, click/type/scroll on the desktop):" +
    "\n1. Call request_pi_control_lease with task title, reason, and mission summary — wait for operator [Grant Control]." +
    "\n2. After grant, call pi_computer_use repeatedly: screenshot first, then step-by-step actions (Win key, type app name, click, type text, hotkey)." +
    "\n3. Read each receipt JSON — adjust coordinates and next action from screenshot/active_window results." +
    "\n4. Report progress in the MUTHUR channel after each meaningful step." +
    "\n5. Release is automatic when the mission completes or the operator retakes control."
  : "\n\nWhen a task requires physical or desktop interaction:" +
    "\n1. Call request_pi_control_lease (auto-grants) then pi_computer_use repeatedly: screenshot first, then step-by-step actions." +
    "\n2. Read each receipt JSON and adjust the next action from screenshot/active_window results." +
    "\n3. Report progress in the MUTHUR channel after each meaningful step.";

const MUTHUR_PI_CONTROL_FOOTER =
  "\n\nDo NOT use workspace_exec, localfs, or operator_browser for tasks that require real desktop embodiment when Pi computer use is available." +
  "\nFor 'draw me a cat' style requests: recognize image creation on the desktop requires computer use → request Pi lease → execute via pi_computer_use.";

export const MUTHUR_PI_CONTROL_DOCTRINE =
  MUTHUR_PI_CONTROL_BASE +
  (isMuthurDirectPiComputerUseEnabled()
    ? MUTHUR_PI_CONTROL_DIRECT_FLOW
    : MUTHUR_PI_CONTROL_DELEGATE_FLOW) +
  MUTHUR_PI_CONTROL_FOOTER;

import type { MuthurPosture } from "@/lib/muthur/muthur-posture";

/** Pi delegation doctrine — Commander + ACTIVE mission only. Agent executes directly. */
export function buildMuthurPiControlDoctrine(posture: MuthurPosture): string {
  if (posture !== "commander") {
    return "";
  }
  return MUTHUR_PI_CONTROL_DOCTRINE;
}
