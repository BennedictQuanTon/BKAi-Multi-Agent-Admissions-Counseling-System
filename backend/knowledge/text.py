"""Vietnamese text normalisation shared by the resolver, BM25 sparse vectors and the cache."""

from __future__ import annotations

import re
import unicodedata

_WORD = re.compile(r"[0-9a-zà-ỹđ]+(?:[.,][0-9]+)?", re.IGNORECASE)


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def strip_accents(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.replace("đ", "d").replace("Đ", "D")


def normalize(text: str) -> str:
    """Lowercase, NFC, unify hyphens/whitespace."""
    text = nfc(text).lower().replace("–", "-").replace("—", "-")
    return " ".join(text.split())


def tokens(text: str) -> list[str]:
    """Syllable tokens + accent-free variants (students often type without diacritics)."""
    norm = normalize(text)
    syll = _WORD.findall(norm)
    out = list(syll)
    out += [strip_accents(t) for t in syll if strip_accents(t) != t]
    # adjacent-syllable bigrams capture Vietnamese compound words ("khoa_học", "máy_tính")
    out += [f"{a}_{b}" for a, b in zip(syll, syll[1:])]
    return out
