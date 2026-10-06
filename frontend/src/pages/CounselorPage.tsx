import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Minus, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CountUp } from "../components/Charts";
import { api, type CalcInput, type CalcResult } from "../lib/api";
import { fadeUp, spring, stagger } from "../lib/motion";
import { cn } from "../lib/utils";

const BAND = {
  an_toan: { label: "An toàn", icon: Check, cls: "bg-brand text-white" },
  vua_suc: { label: "Vừa sức", icon: Minus, cls: "border border-ink text-ink" },
  thu_thach: { label: "Thử thách", icon: TrendingUp, cls: "border border-warm-mist text-graphite" },
  kho: { label: "Khó", icon: TriangleAlert, cls: "bg-hairline text-graphite" },
} as const;

const INTERESTS = ["Khoa học Máy tính", "Kỹ thuật Máy tính", "Trí tuệ Nhân tạo", "Điện - Điện tử", "Cơ khí", "Cơ điện tử", "Ô tô", "Logistics", "Hóa học", "Xây dựng", "Kiến trúc", "Quản lý Công nghiệp", "Bán dẫn"];

function NumberField({ label, value, onChange, step = 0.25, max = 10, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; step?: number; max?: number; hint?: string }) {
  return (
    <label className="block">
      <span className="text-body-sm text-graphite">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={hint}
        className="tabular mt-1 block w-full rounded-inputs border border-warm-mist bg-parchment px-3 py-2 text-body-lg text-ink focus:border-brand focus:outline-none"
      />
    </label>
  );
}

export default function CounselorPage() {
  const [f, setF] = useState<CalcInput>({ thpt_math: 9, thpt_subject2: 8.5, thpt_subject3: 8, hocba_math: 9, hocba_subject2: 8.5, hocba_subject3: 8.5, dgnl: 1050, bonus_points: 0, priority_points_30: 0, program_ids: [], interests: ["Khoa học Máy tính", "Trí tuệ Nhân tạo"] });
  const [programs, setPrograms] = useState<{ program_id: string; name: string }[]>([]);
  const [res, setRes] = useState<CalcResult | null>(null);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.majors().then((m) => setPrograms(m.programs.filter((p) => !["tai_nang", "pfiev", "chuyen_tiep_nhat_ban"].includes(p.program_id)))).catch(() => undefined);
  }, []);

  const set = <K extends keyof CalcInput>(k: K, v: CalcInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k: "program_ids" | "interests", v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);

  async function run() {
    setErr("");
    try {
      setRes(await api.calc(f));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const s = res?.score;
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <h1 className="text-[22px] font-medium tracking-tight">Tính điểm xét tuyển & gợi ý ngành</h1>
        <p className="text-body text-graphite">Công thức Xét tuyển Tổng hợp 2026 chính thức; so với điểm chuẩn 2026. Tính toán xác định, không dùng LLM.</p>
      </motion.header>

      <motion.section variants={stagger(0.04, 0.1)} initial="hidden" animate="show" className="mt-6 rounded-cards border border-hairline bg-soft-paper p-5">
        <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3 text-body text-ink">Điểm thi tốt nghiệp THPT (thang 10)</div>
          <NumberField label="Toán (×2)" value={f.thpt_math} onChange={(v) => set("thpt_math", v ?? 0)} />
          <NumberField label="Môn 2" value={f.thpt_subject2} onChange={(v) => set("thpt_subject2", v ?? 0)} />
          <NumberField label="Môn 3" value={f.thpt_subject3} onChange={(v) => set("thpt_subject3", v ?? 0)} />
          <div className="sm:col-span-3 text-body text-ink">Học bạ — TB lớp 10, 11, 12 (thang 10)</div>
          <NumberField label="Toán (×2)" value={f.hocba_math} onChange={(v) => set("hocba_math", v ?? 0)} />
          <NumberField label="Môn 2" value={f.hocba_subject2} onChange={(v) => set("hocba_subject2", v ?? 0)} />
          <NumberField label="Môn 3" value={f.hocba_subject3} onChange={(v) => set("hocba_subject3", v ?? 0)} />
          <NumberField label="ĐGNL (đã nhân Toán, /1500)" value={f.dgnl} onChange={(v) => set("dgnl", v)} step={1} max={1500} hint="bỏ trống nếu không thi" />
          <NumberField label="Điểm ưu tiên KV + ĐT (thang 30)" value={f.priority_points_30} onChange={(v) => set("priority_points_30", v ?? 0)} step={0.25} max={2.75} />
          <NumberField label="Điểm cộng thành tích (≤10)" value={f.bonus_points} onChange={(v) => set("bonus_points", v ?? 0)} step={0.5} max={10} />
        </motion.div>

        <motion.div variants={fadeUp} className="mt-5">
          <div className="mb-2 text-body-sm text-graphite">Lĩnh vực quan tâm</div>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button key={i} onClick={() => toggle("interests", i)} className={cn("rounded-full px-3 py-1.5 text-body", f.interests.includes(i) ? "bg-brand text-white" : "border border-warm-mist text-ink hover:border-ash")}>
                {i}
              </button>
            ))}
          </div>
          <div className="mb-2 mt-4 text-body-sm text-graphite">Chương trình (bỏ trống = tất cả)</div>
          <div className="flex flex-wrap gap-2">
            {programs.map((p) => (
              <button key={p.program_id} onClick={() => toggle("program_ids", p.program_id)} className={cn("rounded-full px-3 py-1.5 text-body", f.program_ids.includes(p.program_id) ? "bg-brand text-white" : "border border-warm-mist text-ink hover:border-ash")}>
                {p.name.replace("Chương trình ", "")}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-6 flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={run} className="rounded-inputs bg-ink px-4 py-2 text-body text-parchment">
            Tính điểm & gợi ý
          </motion.button>
          {err && <span className="text-body-sm text-graphite">{err}</span>}
        </motion.div>
      </motion.section>

      <AnimatePresence>
        {res && s && (
          <motion.section key={String(s.diem_xet_tuyen)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-[1.2fr_2fr]">
              <div className="rounded-cards border border-hairline bg-soft-paper p-5">
                <div className="text-body-sm text-graphite">Điểm xét tuyển dự kiến · đối tượng {String(s.doi_tuong)}</div>
                <div className="mt-1 text-[56px] font-medium leading-none tracking-tight text-ink">
                  <CountUp value={Number(s.diem_xet_tuyen)} format={(v) => v.toFixed(2)} />
                </div>
                <div className="mt-1 text-body-sm text-ash">/ 100 điểm</div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["Năng lực", s.diem_nang_luc], ["TNTHPT quy đổi", s.diem_tnthpt_quy_doi], ["Học THPT quy đổi", s.diem_hoc_thpt_quy_doi],
                  ["Học lực (70/20/10)", s.diem_hoc_luc], ["Điểm cộng", s.diem_cong], ["Điểm ưu tiên", s.diem_uu_tien],
                ].map(([l, v]) => (
                  <div key={String(l)} className="rounded-inputs border border-hairline bg-soft-paper px-3 py-2">
                    <div className="text-caption text-graphite">{l}</div>
                    <div className="tabular text-body-lg text-ink">{Number(v).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-cards border border-hairline bg-soft-paper">
              <div className="flex items-baseline justify-between px-5 pt-4">
                <h2 className="text-body-lg text-ink">So với điểm chuẩn {res.recommendations.reference_year}</h2>
                <span className="text-body-sm text-graphite">Xét tuyển Tổng hợp</span>
              </div>
              <motion.table variants={stagger(0.03)} initial="hidden" animate="show" className="tabular mt-2 w-full text-body">
                <thead>
                  <tr className="border-b border-hairline text-left text-body-sm text-graphite">
                    <th className="px-5 py-2 font-normal">Ngành</th>
                    <th className="px-2 py-2 font-normal text-right">Điểm chuẩn</th>
                    <th className="px-2 py-2 font-normal text-right">Chênh</th>
                    <th className="px-5 py-2 font-normal text-right">Mức</th>
                  </tr>
                </thead>
                <tbody>
                  {res.recommendations.results.map((r) => {
                    const b = BAND[r.band as keyof typeof BAND];
                    return (
                      <motion.tr key={r.major_code + r.program_name} variants={fadeUp} className="border-b border-hairline last:border-0">
                        <td className="px-5 py-2.5">
                          <div className="text-ink">{r.major_name} <span className="text-graphite">· {r.major_code}</span></div>
                          <div className="text-body-sm text-graphite">{r.program_name}</div>
                        </td>
                        <td className="px-2 py-2.5 text-right text-ink">
                          {r.cutoff.toFixed(2)}
                          {r.trend !== null && (
                            <span className="ml-1 inline-flex items-center text-body-sm text-graphite">
                              {r.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(r.trend).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right text-ink">{r.delta > 0 ? "+" : ""}{r.delta.toFixed(2)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-body-sm", b.cls)}>
                            <b.icon size={12} /> {b.label}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </motion.table>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-5 py-3">
                <span className="text-body-sm text-graphite">{res.recommendations.disclaimer}</span>
                <button
                  onClick={() => navigate("/chat", { state: { q: `Mình được khoảng ${Number(s.diem_xet_tuyen).toFixed(2)} điểm xét tuyển tổng hợp, quan tâm ${f.interests.join(", ") || "các ngành kỹ thuật"}. Nên chọn ngành nào?` } })}
                  className="flex items-center gap-1 text-body text-ink hover:text-graphite"
                >
                  Hỏi BKAi tư vấn chi tiết <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
