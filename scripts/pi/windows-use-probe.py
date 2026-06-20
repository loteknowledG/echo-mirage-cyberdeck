#!/usr/bin/env python3
"""Non-destructive Pi windows-use probe (L-PI-001A)."""

from __future__ import annotations

import json
import sys
import time
import uuid


def make_receipt(
    *,
    status: str,
    summary: str,
    duration_ms: int,
    error: str | None = None,
    data: dict | None = None,
) -> dict:
    payload = {
        "id": f"pi-rcpt-{uuid.uuid4().hex[:12]}",
        "actor": "pi",
        "backend": "windows-use",
        "capability": "screenshot",
        "status": status,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "durationMs": duration_ms,
        "summary": summary,
        "probe": {
            "platform": sys.platform,
            "windowsUseImportOk": False,
            "screenshotOk": False,
            "activeWindowOk": False,
            "mouseMoveSkipped": True,
        },
    }
    if error:
        payload["error"] = error
    if data:
        payload["data"] = data
    return payload


def main() -> int:
    start = time.perf_counter()

    if sys.platform != "win32":
        receipt = make_receipt(
            status="blocked",
            summary="Probe skipped — not Windows",
            duration_ms=int((time.perf_counter() - start) * 1000),
            error=f"Platform {sys.platform} is not supported",
        )
        print(json.dumps(receipt))
        return 0

    try:
        from windows_use.agent.desktop.service import Desktop
    except Exception as exc:  # noqa: BLE001
        receipt = make_receipt(
            status="failed",
            summary="windows-use import failed",
            duration_ms=int((time.perf_counter() - start) * 1000),
            error=str(exc),
        )
        print(json.dumps(receipt))
        return 1

    receipt = make_receipt(
        status="success",
        summary="windows-use import ok",
        duration_ms=int((time.perf_counter() - start) * 1000),
    )
    receipt["probe"]["windowsUseImportOk"] = True

    desktop = Desktop(use_vision=True, use_annotation=False, use_accessibility=False)

    try:
        png = desktop.get_screenshot(as_bytes=True)
        image = desktop.get_screenshot(as_bytes=False)
        receipt["probe"]["screenshotOk"] = len(png) > 0
        receipt["data"] = {
            "screenshot": {
                "width": image.size[0],
                "height": image.size[1],
                "bytes": len(png),
            }
        }
    except Exception as exc:  # noqa: BLE001
        receipt["status"] = "failed"
        receipt["summary"] = "Screenshot probe failed"
        receipt["error"] = str(exc)
        receipt["durationMs"] = int((time.perf_counter() - start) * 1000)
        print(json.dumps(receipt))
        return 1

    try:
        active = desktop.get_active_window()
        receipt["probe"]["activeWindowOk"] = True
        if active is not None:
            receipt["data"]["activeWindow"] = {
                "name": active.name,
                "handle": active.handle,
            }
        else:
            receipt["data"]["activeWindow"] = None
    except Exception as exc:  # noqa: BLE001
        receipt["status"] = "failed"
        receipt["summary"] = "Active window probe failed"
        receipt["error"] = str(exc)
        receipt["durationMs"] = int((time.perf_counter() - start) * 1000)
        print(json.dumps(receipt))
        return 1

    receipt["summary"] = (
        f"Probe ok — screenshot {receipt['data']['screenshot']['width']}x"
        f"{receipt['data']['screenshot']['height']}, active window read"
    )
    receipt["durationMs"] = int((time.perf_counter() - start) * 1000)
    print(json.dumps(receipt))
    return 0 if receipt["status"] == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
