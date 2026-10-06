"""Input sanitisation."""

from __future__ import annotations

import re
import unicodedata


def sanitize_input(text: str, max_length: int = 500) -> str:
    """NFC-normalise, strip control characters, collapse whitespace, enforce the length limit."""
    text = unicodedata.normalize("NFC", text or "")
    text = "".join(c for c in text if unicodedata.category(c)[0] != "C" or c in "\n\t")
    return re.sub(r"\s+", " ", text).strip()[:max_length]
