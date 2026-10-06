"""
Vietnamese text normalisation for speech: markdown/citations removed, numbers → words, acronyms → readings,
then split into short speakable chunks (first chunk kept short to minimise time-to-first-audio).
"""

from __future__ import annotations

import re

DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
ACRONYMS = {
    "BKAi": "bê ka ai", "BKAI": "bê ka ai", "HCMUT": "Bách khoa", "ĐHQG-HCM": "Đại học Quốc gia thành phố Hồ Chí Minh",
    "ĐHQG": "Đại học Quốc gia", "TP.HCM": "thành phố Hồ Chí Minh", "TP. HCM": "thành phố Hồ Chí Minh",
    "ĐGNL": "đánh giá năng lực", "THPT": "trung học phổ thông", "TNTHPT": "tốt nghiệp trung học phổ thông",
    "UTXT": "ưu tiên xét tuyển", "KHMT": "khoa học máy tính", "KTMT": "kỹ thuật máy tính", "CNTT": "công nghệ thông tin",
    "KTX": "ký túc xá", "IELTS": "ai en", "TOEIC": "tô ích", "TOEFL": "tô phồ", "PTE": "pê tê e", "SAT": "ét a tê",
    "UTS": "u tê ét", "TNE": "tê en e", "PFIEV": "pê ép i e vê", "AI": "ây ai", "IT": "ai ti", "VNĐ": "đồng",
    "MyBK": "mai bê ka", "OISP": "ô i ét pê", "QSB": "quy ét bê",
}


def _three(n: int, full: bool) -> str:
    h, t, u = n // 100, (n // 10) % 10, n % 10
    words = []
    if full or h:
        words += [DIGITS[h], "trăm"]
    if t == 0:
        if u and (full or h):
            words.append("linh")
    elif t == 1:
        words.append("mười")
    else:
        words += [DIGITS[t], "mươi"]
    if u:
        if u == 1 and t >= 2:
            words.append("mốt")
        elif u == 5 and t >= 1:
            words.append("lăm")
        elif u == 4 and t >= 2:
            words.append("tư")
        else:
            words.append(DIGITS[u])
    return " ".join(words)


def int_to_words(n: int) -> str:
    if n == 0:
        return "không"
    units = ["", "nghìn", "triệu", "tỷ"]
    groups = []
    while n:
        groups.append(n % 1000)
        n //= 1000
    out = []
    for i in range(len(groups) - 1, -1, -1):
        g = groups[i]
        if g == 0:
            continue
        out.append(_three(g, full=i < len(groups) - 1))
        if units[i]:
            out.append(units[i])
    return " ".join(out)


def decimal_to_words(s: str) -> str:
    whole, frac = re.split(r"[.,]", s, maxsplit=1)
    frac_words = int_to_words(int(frac)) if len(frac) <= 2 and not frac.startswith("0") else " ".join(DIGITS[int(c)] for c in frac)
    return f"{int_to_words(int(whole))} phẩy {frac_words}"


def normalize_for_speech(text: str) -> str:
    t = re.sub(r"\[\d+\]", "", text)                       # citations
    t = re.sub(r"[*_`#>|]", " ", t)                         # markdown
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)          # links
    t = re.sub(r"https?://\S+|\S+@\S+", "", t)
    for k in sorted(ACRONYMS, key=len, reverse=True):
        t = re.sub(rf"(?<![\wÀ-ỹ]){re.escape(k)}(?![\wÀ-ỹ])", ACRONYMS[k], t)
    t = re.sub(r"(\d{1,2})/(\d{1,2})/(\d{4})", lambda m: f"ngày {int_to_words(int(m[1]))} tháng {int_to_words(int(m[2]))} năm {int_to_words(int(m[3]))}", t)
    t = re.sub(r"(\d{1,2})/(\d{1,2})", lambda m: f"ngày {int_to_words(int(m[1]))} tháng {int_to_words(int(m[2]))}", t)
    t = re.sub(r"(\d+)\s*%", lambda m: f"{int_to_words(int(m[1]))} phần trăm", t)
    t = re.sub(r"\b\d{1,3}(?:\.\d{3})+\b", lambda m: int_to_words(int(m[0].replace(".", ""))), t)  # 31.500.000
    t = re.sub(r"\b\d+[.,]\d+\b", lambda m: decimal_to_words(m[0]), t)
    t = re.sub(r"\b\d+\b", lambda m: int_to_words(int(m[0])), t)
    t = re.sub(r"\s*[-–—]\s*", ", ", t)
    return re.sub(r"\s+", " ", t).strip()


def speech_chunks(text: str, first_max: int = 60, max_len: int = 180) -> list[str]:
    """Sentence chunks; the first chunk is cut at a comma when long so audio can start sooner."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?;:])\s+|\n+", normalize_for_speech(text)) if s.strip()]
    chunks: list[str] = []
    for s in sentences:
        while len(s) > max_len and "," in s[:max_len]:
            cut = s[:max_len].rfind(",")
            chunks.append(s[: cut + 1])
            s = s[cut + 1:].strip()
        if s:
            chunks.append(s)
    if chunks and len(chunks[0]) > first_max and "," in chunks[0][:first_max + 40]:
        cut = chunks[0][: first_max + 40].find(",", 20)
        if cut > 0:
            chunks[0:1] = [chunks[0][: cut + 1], chunks[0][cut + 1:].strip()]
    return [c for c in chunks if c]
