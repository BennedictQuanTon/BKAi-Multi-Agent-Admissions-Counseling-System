"""Expand an HTML table (with rowspan/colspan) into a dense rectangular grid."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GridCell:
    text: str               # whitespace-collapsed text
    spanned_rows: int = 1   # rowspan of the originating cell
    spanned_cols: int = 1   # colspan of the originating cell
    origin_row: int = 0     # row index of the originating cell
    raw: str = ""           # original innerText (keeps line breaks)


def expand_table(rows: list[list[dict]]) -> list[list[GridCell]]:
    """`rows` is [[{"t": text, "cs": colspan, "rs": rowspan}, ...], ...] as scraped from the DOM."""
    grid: dict[tuple[int, int], GridCell] = {}
    width = 0
    for r, row in enumerate(rows):
        c = 0
        for cell in row:
            while (r, c) in grid:
                c += 1
            cs, rs = max(int(cell.get("cs", 1)), 1), max(int(cell.get("rs", 1)), 1)
            raw = str(cell.get("t", "")).replace("\xa0", " ")
            text = " ".join(raw.split())
            for dr in range(rs):
                for dc in range(cs):
                    grid[(r + dr, c + dc)] = GridCell(text, rs, cs, r, raw)
            c += cs
            width = max(width, c)
    height = max((r for r, _ in grid), default=-1) + 1
    return [[grid.get((r, c), GridCell("")) for c in range(width)] for r in range(height)]
