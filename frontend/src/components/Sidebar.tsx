import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Calculator, MessageSquare, Mic, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { loadHistory, type HistoryItem } from "../lib/api";
import { spring } from "../lib/motion";
import { cn } from "../lib/utils";

const NAV = [
  { to: "/", label: "Hỏi đáp", icon: MessageSquare },
  { to: "/voice", label: "Trò chuyện giọng nói", icon: Mic },
  { to: "/counselor", label: "Tính điểm & chọn ngành", icon: Calculator },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

export function BrandMark({ size = 22 }: { size?: number }) {
  // The source dot: brackets of a citation around the one fact that matters (brand/BRAND.md).
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2e2e2e" />
      <path d="M12.4 9.2H9.4v13.6h3M19.6 9.2h3v13.6h-3" fill="none" stroke="#fdfcfb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.7" fill="#207dff" />
    </svg>
  );
}

export function Sidebar({ onNewChat, collapsed, onToggle }: { onNewChat: () => void; collapsed: boolean; onToggle: () => void }) {
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const refresh = () => setHistory(loadHistory());
    window.addEventListener("bkai-history", refresh);
    return () => window.removeEventListener("bkai-history", refresh);
  }, []);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 260 }}
      transition={spring}
      className="hidden md:flex h-full shrink-0 flex-col border-r border-hairline bg-sidebar overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5" aria-label="BKAi trang chủ">
          <BrandMark />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[16px] font-medium tracking-tight">
                BKAi
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        {!collapsed && (
          <button onClick={onToggle} className="rounded-buttons p-1 text-graphite hover:text-ink" aria-label="Thu gọn">
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>
      {collapsed && (
        <button onClick={onToggle} className="mx-auto mb-2 rounded-buttons p-1 text-graphite hover:text-ink" aria-label="Mở rộng">
          <PanelLeftOpen size={16} />
        </button>
      )}

      <div className="px-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onNewChat}
          className={cn(
            "flex w-full items-center gap-2 rounded-inputs border border-warm-mist bg-soft-paper px-3 py-2 text-body text-ink hover:border-ash",
            collapsed && "justify-center px-0",
          )}
        >
          <Plus size={16} />
          {!collapsed && <span>Cuộc trò chuyện mới</span>}
        </motion.button>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} className="relative flex items-center gap-2.5 rounded-inputs px-3 py-2 text-body" title={label}>
              {active && <motion.span layoutId="nav-pill" transition={spring} className="absolute inset-0 rounded-inputs bg-deep-teal" />}
              <Icon size={16} className={cn("relative", active ? "text-white" : "text-graphite")} />
              {!collapsed && <span className={cn("relative whitespace-nowrap", active ? "text-white" : "text-graphite hover:text-ink")}>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && history.length > 0 && (
        <div className="mt-6 flex min-h-0 flex-1 flex-col px-3">
          <div className="px-3 pb-1.5 text-body-sm text-graphite">Gần đây</div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => navigate(`/?s=${h.id}`)}
                className="block w-full truncate rounded-buttons px-3 py-1.5 text-left text-body text-graphite hover:bg-parchment hover:text-ink"
              >
                {h.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="mt-auto border-t border-hairline px-6 py-3 text-caption text-ash">
          Dữ liệu chính thức hcmut.edu.vn · mùa tuyển sinh 2026
        </div>
      )}
    </motion.aside>
  );
}
