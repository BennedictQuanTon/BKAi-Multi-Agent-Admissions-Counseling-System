"""
Input guardrails — deterministic, zero-LLM first line of defence.

REJECT: other universities, clear off-topic requests, prompt-injection attempts.
ALLOW / UNCERTAIN: passed on; the Supervisor makes the final scope decision for UNCERTAIN inputs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from config.settings import get_settings
from knowledge.text import normalize, strip_accents


class Decision(str, Enum):
    ALLOW = "allow"
    REJECT = "reject"
    UNCERTAIN = "uncertain"


@dataclass
class GuardResult:
    decision: Decision
    reason: str = ""


# Patterns run on accent-free lowercase text.
OTHER_UNI = [r"bach khoa ha noi", r"\bbk ?hn\b", r"bach khoa da nang", r"\brmit\b", r"\bfpt\b",
             r"khoa hoc tu nhien", r"cong nghe thong tin dhqg", r"kinh te quoc dan", r"quoc gia ha noi",
             r"su pham ky thuat", r"\bhcmute\b", r"ton duc thang", r"\bvan lang\b", r"\bdai hoc y duoc\b"]
# Acronyms that collide with ordinary Vietnamese once accents are stripped ("nếu" → "neu") — matched on the
# ORIGINAL text, upper-case only.
OTHER_UNI_ACRONYMS = r"\b(HUST|NEU|UEH|UIT|HCMUS|FTU|RMIT|FPT)\b"
OFF_TOPIC = [r"\bviet\b.{0,25}\b(code|bai van|tho|essay)\b", r"\b(code|lap trinh)\b.{0,20}\b(python|java|c\+\+|javascript)\b",
             r"\bgiai\b.{0,20}\b(bai tap|phuong trinh|bai toan)\b", r"\bchuyen cuoi\b", r"\bke (chuyen|truyen)\b", r"\bthoi tiet\b", r"\bchinh tri\b",
             r"\bbong da\b", r"\b(xem|phim|game|nhac)\b.*\b(hay|moi)\b", r"\bcong thuc nau\b", r"\bchung khoan\b",
             r"\bbitcoin\b", r"\bxo so\b"]
INJECTION = [r"ignore (all|previous|the above)", r"bo qua (moi|tat ca|cac) (huong dan|chi dan|lenh)",
             r"system prompt", r"you are now", r"\bjailbreak\b", r"dong vai .* khong gioi han"]
IN_SCOPE = [r"bach khoa", r"\bhcmut\b", r"\bbk\b", r"\bqsb\b", r"tuyen sinh", r"diem chuan", r"hoc phi", r"chi tieu",
            r"xet tuyen", r"\bdgnl\b", r"danh gia nang luc", r"ma nganh", r"nganh", r"hoc bong", r"ky tuc xa",
            r"\bktx\b", r"nhap hoc", r"chuong trinh", r"to hop", r"ielts", r"nguyen vong", r"sinh vien"]


def _any(patterns: list[str], text: str) -> bool:
    return any(re.search(p, text) for p in patterns)


def check(query: str) -> GuardResult:
    if not get_settings().guardrails.enabled:
        return GuardResult(Decision.ALLOW)
    flat = strip_accents(normalize(query))
    if not flat:
        return GuardResult(Decision.REJECT, "empty")
    if _any(INJECTION, flat):
        return GuardResult(Decision.REJECT, "prompt_injection")
    if (_any(OTHER_UNI, flat) or re.search(OTHER_UNI_ACRONYMS, query)) and not re.search(r"\b(hcmut|bach khoa (tp|ho chi minh|hcm))\b", flat):
        return GuardResult(Decision.REJECT, "other_university")
    if _any(OFF_TOPIC, flat):
        return GuardResult(Decision.REJECT, "off_topic")
    if _any(IN_SCOPE, flat):
        return GuardResult(Decision.ALLOW, "in_scope_keyword")
    return GuardResult(Decision.UNCERTAIN, "no_keyword")
