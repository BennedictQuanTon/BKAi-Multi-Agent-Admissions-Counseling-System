"""Official HCMUT admissions sources crawled by the datahub."""

from __future__ import annotations

from dataclasses import dataclass

BASE = "https://hcmut.edu.vn"
ADMISSIONS = f"{BASE}/tuyen-sinh/dai-hoc-chinh-quy"


@dataclass(frozen=True)
class Source:
    slug: str
    url: str
    topic: str
    title: str
    has_score_table: bool = False


SOURCES: list[Source] = [
    Source("nganh-va-chi-tieu", f"{ADMISSIONS}/nganh-va-chi-tieu", "nganh_chi_tieu",
           "Ngành, chỉ tiêu, tổ hợp và điểm chuẩn 3 năm gần nhất", has_score_table=True),
    Source("gioi-thieu-chung", f"{ADMISSIONS}/gioi-thieu-chung", "tong_quan_tuyen_sinh",
           "Giới thiệu chung tuyển sinh đại học chính quy 2026"),
    Source("phuong-thuc-tuyen-sinh", f"{ADMISSIONS}/phuong-thuc-tuyen-sinh", "phuong_thuc",
           "Phương thức tuyển sinh, chuẩn tiếng Anh, học phí, quy chế"),
    Source("xet-tuyen-tong-hop-2026", f"{ADMISSIONS}/phuong-thuc-tuyen-sinh/xet-tuyen-tong-hop-2026",
           "xet_tuyen_tong_hop", "Phương thức Xét tuyển Tổng hợp 2026"),
    Source("xet-tuyen-thang-2026", f"{ADMISSIONS}/phuong-thuc-tuyen-sinh/xet-tuyen-thang-2026",
           "xet_tuyen_thang", "Xét tuyển thẳng, ưu tiên xét tuyển thẳng 2026"),
    Source("xet-tuyen-pfiev-2026", f"{ADMISSIONS}/phuong-thuc-tuyen-sinh/xet-tuyen-pfiev-2026",
           "pfiev", "Xét tuyển chương trình Kỹ sư Chất lượng cao Việt - Pháp (PFIEV) 2026"),
    Source("xet-tuyen-ctqtnb-2026", f"{ADMISSIONS}/phuong-thuc-tuyen-sinh/xet-tuyen-ctqtnb-2026",
           "chuyen_tiep_nhat_ban", "Xét tuyển chương trình Chuyển tiếp Quốc tế Nhật Bản 2026"),
    Source("xet-tuyen-tne-2026",
           f"{ADMISSIONS}/phuong-thuc-tuyen-sinh/xet-tuyen-bo-sung-lien-ket-cu-nhan-ky-thuat-quoc-te-2026",
           "lien_ket_tne", "Xét tuyển bổ sung chương trình Liên kết Cử nhân Kỹ thuật Quốc tế (TNE) 2026"),
    Source("chuong-trinh-dao-tao", f"{ADMISSIONS}/chuong-trinh-dao-tao", "chuong_trinh",
           "Các chương trình đào tạo"),
    Source("ket-qua-xet-tuyen", f"{ADMISSIONS}/ket-qua-xet-tuyen", "lich_tuyen_sinh",
           "Kết quả xét tuyển và các mốc thời gian 2026"),
    Source("thong-tin-nhap-hoc", f"{ADMISSIONS}/thong-tin-nhap-hoc", "nhap_hoc",
           "Thông tin nhập học khóa 2026"),
    Source("thong-tin-lien-he", f"{ADMISSIONS}/thong-tin-lien-he", "lien_he",
           "Thông tin liên hệ tuyển sinh"),
    Source("quy-doi-chung-chi-anh", f"{BASE}/news/item/11141", "quy_doi_tieng_anh",
           "Quy đổi chứng chỉ tiếng Anh sang điểm môn tiếng Anh"),
    Source("cong-viec-nhap-hoc-2026", f"{BASE}/news/item/12564", "nhap_hoc",
           "Các công việc nhập học cho tân sinh viên khóa 2026"),
    Source("kiem-tra-anh-van-xep-lop", f"{BASE}/news/item/12567", "nhap_hoc",
           "Quy định kỳ kiểm tra Anh văn xếp lớp"),
    Source("lich-nhap-hoc-phu-luc-3", f"{BASE}/news/item/12568", "nhap_hoc",
           "Lịch nộp hồ sơ nhập học và sinh hoạt đầu khóa (Phụ lục 3)"),
]

SOURCE_BY_SLUG = {s.slug: s for s in SOURCES}
