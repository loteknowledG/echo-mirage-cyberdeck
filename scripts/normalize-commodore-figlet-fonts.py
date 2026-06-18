#!/usr/bin/env python3
"""Normalize Commodore2Figlet .flf files so figlet.js can render them on Vercel."""
from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import pyfiglet
except ImportError:
    print(
        "normalize-commodore-figlet-fonts: pyfiglet not installed "
        "(pip install -r requirements-glyph.txt)",
        file=sys.stderr,
    )
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = REPO_ROOT / "assets" / "figlet-fonts"

# figlet.js 1.11 expects this set (see parseFont in figlet-DvMutUbn.cjs).
FIGLET_JS_CHAR_CODES = list(range(32, 127)) + [196, 214, 220, 228, 246, 252, 223]


def is_commodore_font(path: Path) -> bool:
    try:
        head = path.read_text(encoding="utf-8", errors="replace")[:4096]
    except OSError:
        return False
    return "Commodore2Figlet" in head


def load_pyfiglet_font(font_name: str) -> pyfiglet.FigletFont:
    previous = os.getcwd()
    os.chdir(FONT_DIR)
    try:
        return pyfiglet.FigletFont(font_name)
    finally:
        os.chdir(previous)


def write_figlet_js_flf(font: pyfiglet.FigletFont, dest: Path) -> None:
    height = int(font.height)
    hardblank = font.hardBlank or "$"
    max_width = max(font.width.values()) if font.width else 1
    comment_lines = [
        f'"{font.font}" normalized for figlet.js (Echo Mirage build)',
        "Converted from Commodore2Figlet via pyfiglet — do not hand-edit.",
    ]
    header = (
        f"flf2a{hardblank} {height} {max(height - 1, 0)} {max_width} "
        f"15 {len(comment_lines)} 0 24463 0\n"
    )

    blank_row = hardblank * max_width
    parts: list[str] = [header]
    parts.extend(f"{line}\n" for line in comment_lines)

    for code in FIGLET_JS_CHAR_CODES:
        glyph = font.chars.get(code, [blank_row] * height)
        for row_idx in range(height):
            row = (glyph[row_idx] if row_idx < len(glyph) else blank_row).rstrip("@")
            suffix = "@@" if row_idx == height - 1 else "@"
            parts.append(f"{row}{suffix}\n")

    dest.write_text("".join(parts), encoding="utf-8")


def main() -> None:
    if not FONT_DIR.is_dir():
        print(f"[normalize-commodore] skip — missing {FONT_DIR}")
        return

    converted = 0
    skipped = 0
    failed = 0

    for path in sorted(FONT_DIR.glob("*.flf")):
        if not is_commodore_font(path):
            skipped += 1
            continue
        font_name = path.stem
        try:
            font = load_pyfiglet_font(font_name)
            write_figlet_js_flf(font, path)
            converted += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"[normalize-commodore] failed {font_name}: {exc}", file=sys.stderr)

    print(
        f"[normalize-commodore] converted {converted}, skipped {skipped}, failed {failed}",
    )


if __name__ == "__main__":
    main()
