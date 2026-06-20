#!/usr/bin/env python3
"""Pi windows-use bridge — JSON command surface for Echo Mirage (L-PI-001A)."""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import uuid
from typing import Any

CAPABILITIES = (
    "check",
    "screenshot",
    "mouse_move",
    "mouse_click",
    "double_click",
    "type_text",
    "hotkey",
    "scroll",
    "active_window",
)


def make_receipt(
    capability: str,
    status: str,
    summary: str,
    duration_ms: int,
    *,
    error: str | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": f"pi-rcpt-{uuid.uuid4().hex[:12]}",
        "actor": "pi",
        "backend": "windows-use",
        "capability": capability,
        "status": status,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "durationMs": duration_ms,
        "summary": summary,
    }
    if error:
        payload["error"] = error
    if data is not None:
        payload["data"] = data
    return payload


def serialize_window(window: Any | None) -> dict[str, Any] | None:
    if window is None:
        return None
    box = window.bounding_box
    status = window.status.value if hasattr(window.status, "value") else str(window.status)
    return {
        "name": window.name,
        "handle": window.handle,
        "processId": window.process_id,
        "isBrowser": window.is_browser,
        "status": status,
        "boundingBox": {
            "left": box.left,
            "top": box.top,
            "right": box.right,
            "bottom": box.bottom,
            "width": box.width,
            "height": box.height,
        },
    }


def get_desktop():
    from windows_use.agent.desktop.service import Desktop

    return Desktop(use_vision=False, use_annotation=False, use_accessibility=False)


def handle_check() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        from windows_use.agent.desktop.service import Desktop  # noqa: F401

        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "screenshot",
            "success",
            "windows-use import ok",
            duration_ms,
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "screenshot",
            "failed",
            "windows-use import failed",
            duration_ms,
            error=str(exc),
        )


def handle_screenshot() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        desktop = get_desktop()
        png_bytes = desktop.get_screenshot(as_bytes=True)
        image = desktop.get_screenshot(as_bytes=False)
        width, height = image.size
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "screenshot",
            "success",
            f"Captured {width}x{height} screenshot",
            duration_ms,
            data={
                "mimeType": "image/png",
                "base64": base64.b64encode(png_bytes).decode("ascii"),
                "width": width,
                "height": height,
            },
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "screenshot",
            "failed",
            "Screenshot failed",
            duration_ms,
            error=str(exc),
        )


def handle_active_window() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        desktop = get_desktop()
        active = desktop.get_active_window()
        duration_ms = int((time.perf_counter() - start) * 1000)
        if active is None:
            return make_receipt(
                "active_window",
                "success",
                "No active window detected",
                duration_ms,
                data={"window": None},
            )
        window = serialize_window(active)
        name = window["name"] if window else "unknown"
        return make_receipt(
            "active_window",
            "success",
            f"Active window: {name}",
            duration_ms,
            data={"window": window},
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "active_window",
            "failed",
            "Active window query failed",
            duration_ms,
            error=str(exc),
        )


def handle_mouse_move(params: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    x = int(params.get("x", 0))
    y = int(params.get("y", 0))
    try:
        desktop = get_desktop()
        desktop.move((x, y))
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "mouse_move",
            "success",
            f"Moved mouse to ({x}, {y})",
            duration_ms,
            data={"x": x, "y": y},
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "mouse_move",
            "failed",
            "Mouse move failed",
            duration_ms,
            error=str(exc),
        )


def handle_mouse_click(params: dict[str, Any], *, double: bool = False) -> dict[str, Any]:
    start = time.perf_counter()
    x = int(params.get("x", 0))
    y = int(params.get("y", 0))
    button = str(params.get("button", "left"))
    capability = "double_click" if double else "mouse_click"
    try:
        desktop = get_desktop()
        clicks = 2 if double else 1
        desktop.click((x, y), button=button, clicks=clicks)
        duration_ms = int((time.perf_counter() - start) * 1000)
        label = "Double-clicked" if double else "Clicked"
        return make_receipt(
            capability,
            "success",
            f"{label} {button} at ({x}, {y})",
            duration_ms,
            data={"x": x, "y": y, "button": button},
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            capability,
            "failed",
            f"{capability} failed",
            duration_ms,
            error=str(exc),
        )


def handle_type_text(params: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    text = str(params.get("text", ""))
    try:
        desktop = get_desktop()
        if "x" in params and "y" in params:
            desktop.type(
                (int(params["x"]), int(params["y"])),
                text=text,
                caret_position="none",
                clear="false",
                press_enter="false",
            )
        else:
            import windows_use.uia as uia
            from windows_use.agent.desktop.utils import escape_text_for_sendkeys

            uia.SendKeys(escape_text_for_sendkeys(text), interval=0.01, waitTime=0.05)
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "type_text",
            "success",
            f"Typed {len(text)} characters",
            duration_ms,
            data={"length": len(text)},
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "type_text",
            "failed",
            "Type text failed",
            duration_ms,
            error=str(exc),
        )


def handle_hotkey(params: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    keys = params.get("keys") or []
    if not isinstance(keys, list):
        keys = [str(keys)]
    shortcut = "+".join(str(key) for key in keys)
    try:
        desktop = get_desktop()
        desktop.shortcut(shortcut)
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "hotkey",
            "success",
            f"Sent hotkey {shortcut}",
            duration_ms,
            data={"keys": keys},
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "hotkey",
            "failed",
            "Hotkey failed",
            duration_ms,
            error=str(exc),
        )


def handle_scroll(params: dict[str, Any]) -> dict[str, Any]:
    start = time.perf_counter()
    direction = str(params.get("direction", "down"))
    amount = max(1, int(params.get("amount", 3)))
    try:
        desktop = get_desktop()
        if direction not in ("up", "down"):
            raise ValueError(f'Invalid scroll direction "{direction}"')
        desktop.scroll(
            loc=None,
            type="vertical",
            direction=direction,
            wheel_times=amount,
        )
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "scroll",
            "success",
            f"Scrolled {direction} by {amount}",
            duration_ms,
            data={"direction": direction, "amount": amount},
        )
    except Exception as exc:  # noqa: BLE001
        duration_ms = int((time.perf_counter() - start) * 1000)
        return make_receipt(
            "scroll",
            "failed",
            "Scroll failed",
            duration_ms,
            error=str(exc),
        )


def dispatch(payload: dict[str, Any]) -> dict[str, Any]:
    capability = str(payload.get("capability", "check"))
    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}

    if capability == "check":
        return handle_check()
    if capability == "screenshot":
        return handle_screenshot()
    if capability == "active_window":
        return handle_active_window()
    if capability == "mouse_move":
        return handle_mouse_move(params)
    if capability == "mouse_click":
        return handle_mouse_click(params, double=False)
    if capability == "double_click":
        return handle_mouse_click(params, double=True)
    if capability == "type_text":
        return handle_type_text(params)
    if capability == "hotkey":
        return handle_hotkey(params)
    if capability == "scroll":
        return handle_scroll(params)

    return make_receipt(
        capability,
        "blocked",
        f"Unsupported capability: {capability}",
        0,
        error=f"Supported: {', '.join(CAPABILITIES)}",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Pi windows-use JSON bridge")
    parser.add_argument(
        "payload",
        nargs="?",
        default="-",
        help='JSON payload or "-" to read stdin',
    )
    args = parser.parse_args()

    if sys.platform != "win32":
        print(
            json.dumps(
                make_receipt(
                    "screenshot",
                    "blocked",
                    "windows-use requires Windows",
                    0,
                    error=f"Platform {sys.platform} is not supported",
                )
            )
        )
        return 2

    raw = args.payload
    if raw == "-":
        raw = sys.stdin.read().strip()
    if not raw:
        raw = json.dumps({"capability": "check"})

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(
            json.dumps(
                make_receipt(
                    "screenshot",
                    "failed",
                    "Invalid JSON payload",
                    0,
                    error=str(exc),
                )
            )
        )
        return 1

    result = dispatch(payload if isinstance(payload, dict) else {})
    print(json.dumps(result))
    return 0 if result.get("status") == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
