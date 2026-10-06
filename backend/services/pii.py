"""PII redaction before anything is persisted (telemetry, logs). Students do paste CCCD / phone numbers."""

from __future__ import annotations

import re

_PATTERNS = [
    (re.compile(r"\b\d{12}\b"), "[CCCD]"),                                  # citizen ID
    (re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){9,10}(?!\d)"), "[SĐT]"),  # VN phone
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[EMAIL]"),
]


def redact(text: str) -> str:
    for pat, repl in _PATTERNS:
        text = pat.sub(repl, text)
    return text
