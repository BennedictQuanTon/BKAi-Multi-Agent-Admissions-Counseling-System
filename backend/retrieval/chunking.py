"""
Structure-aware, contextual parent/child chunking for curated Markdown documents.

- Sections are detected from Markdown headings AND the official site's bold / ALL-CAPS pseudo-headings.
- Tables are never split mid-row; oversized tables are split by rows with the header repeated.
- Each child chunk is embedded with a contextual header "title › section" (contextual retrieval);
  its parent (the whole section, or a neighbour window) is what the LLM reads.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from config.settings import DOCUMENTS_DIR

MAX_CHILD_CHARS = 900
MIN_CHILD_CHARS = 120
MAX_PARENT_CHARS = 2400
_NS = uuid.UUID("6f1c9a8e-2b9d-4c55-9a0e-0b6b2f6b1a11")

_MD_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_BOLD_LINE = re.compile(r"^\*\*([^*=]{3,90}?)\*\*:?\s*$")


@dataclass
class Chunk:
    id: str
    doc_id: str
    title: str
    section: str
    text: str
    parent_text: str
    meta: dict = field(default_factory=dict)

    @property
    def embed_text(self) -> str:
        section = self.section
        if section.startswith(self.title):
            section = section[len(self.title):].lstrip(" ›")
        head = f"{self.title} › {section}" if section else self.title
        return f"{head}\n{self.text}"


def read_document(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    meta: dict = {}
    if raw.startswith("---"):
        end = raw.index("\n---", 3)
        for line in raw[3:end].strip().splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = json.loads(v.strip())
        raw = raw[end + 4:]
    return meta, raw.strip()


def _is_caps_heading(line: str) -> bool:
    letters = [c for c in line if c.isalpha()]
    return 6 <= len(line) <= 140 and "|" not in line and len(letters) >= 5 and all(c.isupper() for c in letters)


def _sections(body: str) -> list[tuple[str, str]]:
    """→ [(section_path, text)]"""
    out: list[tuple[str, list[str]]] = []
    major, minor = "", ""
    current: list[str] = []

    def flush():
        if any(x.strip() for x in current):
            out.append((" › ".join(p for p in (major, minor) if p), current.copy()))
        current.clear()

    for line in body.splitlines():
        s = line.strip()
        m = _MD_HEADING.match(s)
        b = _BOLD_LINE.match(s)
        if m:
            flush()
            if len(m.group(1)) <= 2:
                major, minor = m.group(2).strip("* "), ""
            else:
                minor = m.group(2).strip("* ")
            continue
        if b or _is_caps_heading(s):
            flush()
            minor = (b.group(1) if b else s).strip(" :*")
            current.append(line)  # keep pseudo-heading text inside the chunk too
            continue
        current.append(line)
    flush()
    merged: list[tuple[str, str]] = []
    carry = ""
    for path, lines in out:  # glue tiny sections (lone headings, one-liners) onto the next one
        text = (carry + "\n\n" + "\n".join(lines)).strip() if carry else "\n".join(lines).strip()
        if len(text) < 2 * MIN_CHILD_CHARS:
            carry = text
            continue
        carry = ""
        merged.append((path, text))
    if carry:
        if merged:
            merged[-1] = (merged[-1][0], merged[-1][1] + "\n\n" + carry)
        else:
            merged.append(("", carry))
    return merged


def _blocks(text: str) -> list[str]:
    blocks, buf, in_table = [], [], False
    for line in text.splitlines():
        is_row = line.lstrip().startswith("|")
        if is_row != in_table or (not line.strip() and not in_table):
            if buf:
                blocks.append("\n".join(buf).strip())
            buf = []
            in_table = is_row
        if line.strip():
            buf.append(line)
    if buf:
        blocks.append("\n".join(buf).strip())
    return [b for b in blocks if b]


def _split_big(block: str) -> list[str]:
    if len(block) <= MAX_CHILD_CHARS:
        return [block]
    lines = block.splitlines()
    if lines[0].lstrip().startswith("|"):
        header = lines[:2] if len(lines) > 1 and set(lines[1].replace("|", "").strip()) <= set("-: ") else lines[:1]
        rows, parts, cur = lines[len(header):], [], []
        for r in rows:
            if cur and len("\n".join(header + cur + [r])) > MAX_CHILD_CHARS:
                parts.append("\n".join(header + cur))
                cur = []
            cur.append(r)
        if cur:
            parts.append("\n".join(header + cur))
        return parts
    sents = re.split(r"(?<=[.;:!?])\s+|\n", block)
    parts, cur = [], ""
    for s in sents:
        if cur and len(cur) + len(s) > MAX_CHILD_CHARS:
            parts.append(cur.strip())
            cur = ""
        cur += s + " "
    if cur.strip():
        parts.append(cur.strip())
    return parts


def chunk_document(path: Path) -> list[Chunk]:
    meta, body = read_document(path)
    doc_id = meta.get("id", path.stem)
    title = meta.get("title", path.stem)
    payload = {k: meta[k] for k in ("topic", "year", "source_type", "source_url", "program_id", "major_codes") if k in meta}
    chunks: list[Chunk] = []

    for section, text in _sections(body) or [("", body)]:
        pieces: list[str] = []
        cur = ""
        for block in _blocks(text):
            for part in _split_big(block):
                if cur and len(cur) + len(part) + 2 > MAX_CHILD_CHARS:
                    pieces.append(cur)
                    cur = ""
                cur = f"{cur}\n\n{part}" if cur else part
        if cur:
            pieces.append(cur)
        if len(pieces) > 1 and len(pieces[-1]) < MIN_CHILD_CHARS:
            tail = pieces.pop()
            pieces[-1] += "\n\n" + tail
        for i, piece in enumerate(pieces):
            if len(text) <= MAX_PARENT_CHARS:
                parent = text
            else:  # neighbour window keeps the parent bounded
                parent = "\n\n".join(pieces[max(0, i - 1): i + 2])[:MAX_PARENT_CHARS]
            n = len(chunks)
            chunks.append(Chunk(
                id=str(uuid.uuid5(_NS, f"{doc_id}#{n}")), doc_id=doc_id, title=title, section=section,
                text=piece, parent_text=parent, meta=payload,
            ))
    return [c for c in chunks if len(c.text) >= 40]


def chunk_corpus(root: Path = DOCUMENTS_DIR) -> list[Chunk]:
    out: list[Chunk] = []
    for path in sorted(root.rglob("*.md")):
        out.extend(chunk_document(path))
    return out
