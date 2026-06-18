#!/usr/bin/env python3
"""CLI bridge for Node glyph APIs — list fonts and render via pyfiglet."""
from __future__ import annotations

import argparse
import json
import os
import sys

try:
    import pyfiglet
except ImportError:
    print(
        json.dumps({"ok": False, "error": "pyfiglet not installed (pip install pyfiglet)"}),
        file=sys.stderr,
    )
    sys.exit(2)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_FONT_DIR = os.path.join(REPO_ROOT, "assets", "figlet-fonts")


def _font_file_in_assets(font: str) -> str | None:
    for ext in ("flf", "tlf"):
        candidate = os.path.join(ASSETS_FONT_DIR, f"{font}.{ext}")
        if os.path.isfile(candidate):
            return candidate
    return None


def cmd_list() -> None:
    fonts = set(pyfiglet.FigletFont.getFonts())
    if os.path.isdir(ASSETS_FONT_DIR):
        for name in os.listdir(ASSETS_FONT_DIR):
            if name.endswith((".flf", ".tlf")):
                fonts.add(name.rsplit(".", 1)[0])
    ordered = sorted(fonts, key=str.casefold)
    json.dump({"ok": True, "fonts": ordered}, sys.stdout)


def cmd_render(font: str, text: str) -> None:
    try:
        if _font_file_in_assets(font):
            old_cwd = os.getcwd()
            try:
                os.chdir(ASSETS_FONT_DIR)
                out = pyfiglet.figlet_format(text, font=font)
            finally:
                os.chdir(old_cwd)
        else:
            out = pyfiglet.figlet_format(text, font=font)
    except Exception as exc:  # noqa: BLE001
        json.dump({"ok": False, "error": str(exc)}, sys.stderr)
        sys.exit(1)
    json.dump({"ok": True, "output": out}, sys.stdout)


def main() -> None:
    parser = argparse.ArgumentParser(description="pyfiglet bridge for echo-mirage glyph channel")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="JSON list of font names")

    render_p = sub.add_parser("render", help="Render text to JSON { output }")
    render_p.add_argument("--font", required=True)
    render_p.add_argument("--text", required=True)

    args = parser.parse_args()
    if args.command == "list":
        cmd_list()
    elif args.command == "render":
        cmd_render(args.font, args.text)


if __name__ == "__main__":
    main()
