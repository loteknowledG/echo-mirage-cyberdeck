#!/usr/bin/env python3
"""CLI bridge for Node glyph APIs — list fonts and render via pyfiglet."""
from __future__ import annotations

import argparse
import json
import sys

try:
    import pyfiglet
except ImportError:
    print(
        json.dumps({"ok": False, "error": "pyfiglet not installed (pip install pyfiglet)"}),
        file=sys.stderr,
    )
    sys.exit(2)


def cmd_list() -> None:
    fonts = sorted(pyfiglet.FigletFont.getFonts(), key=str.casefold)
    json.dump({"ok": True, "fonts": fonts}, sys.stdout)


def cmd_render(font: str, text: str) -> None:
    try:
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
