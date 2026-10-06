import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Activity, BarChart3, Calculator, MessageSquare, Mic } from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BrandMark, Sidebar } from "./components/Sidebar";
import { api, getSessionId, newSessionId } from "./lib/api";
import { page } from "./lib/motion";
import { cn } from "./lib/utils";
import ChatPage from "./pages/ChatPage";

const VoicePage = lazy(() => import("./pages/VoicePage"));
const CounselorPage = lazy(() => import("./pages/CounselorPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ObservabilityPage = lazy(() => import("./pages/ObservabilityPage"));

const MOBILE_NAV = [
  { to: "/", icon: MessageSquare, label: "Hỏi đáp" },
  { to: "/voice", icon: Mic, label: "Giọng nói" },
  { to: "/counselor", icon: Calculator, label: "Tính điểm" },
  { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(() => getSessionId());
  const [collapsed, setCollapsed] = useState(false);
  const [observe, setObserve] = useState(false);

  const newChat = useCallback(() => {
    api.clearSession(sessionId).catch(() => undefined);
    setSessionId(newSessionId());
    navigate("/");
  }, [sessionId, navigate]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full bg-parchment text-ink">
        <Sidebar onNewChat={newChat} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-hairline px-4 py-2.5 md:hidden">
            <BrandMark />
            <span className="text-body-lg font-medium">BKAi</span>
            <button onClick={newChat} className="ml-auto rounded-buttons border border-warm-mist px-2.5 py-1 text-body-sm">Mới</button>
          </header>
          <main className="relative min-h-0 flex-1 overflow-hidden">
            {location.pathname !== "/observability" && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setObserve(true)}
                title="Observability — theo dõi hệ thống thời gian thực"
                aria-label="Mở Observability"
                className="absolute right-4 top-3 z-30 grid h-9 w-9 place-items-center rounded-inputs border border-warm-mist bg-soft-paper text-ink shadow-subtle hover:border-ash"
              >
                <Activity size={17} />
              </motion.button>
            )}
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname + sessionId} variants={page} initial="hidden" animate="show" exit="exit" className="h-full overflow-y-auto scrollbar-thin">
                <Suspense fallback={<div className="p-8 text-body text-graphite">Đang tải…</div>}>
                  <Routes location={location}>
                    <Route path="/" element={<ChatPage sessionId={sessionId} onFirstQuestion={() => undefined} />} />
                    <Route path="/voice" element={<VoicePage />} />
                    <Route path="/counselor" element={<CounselorPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/observability" element={<ObservabilityPage />} />
                  </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
          <nav className="flex border-t border-hairline md:hidden">
            {MOBILE_NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-caption", isActive ? "text-deep-teal" : "text-graphite")}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <AnimatePresence>
        {observe && (
          <motion.div className="fixed inset-0 z-40 bg-ink/25 p-2 sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setObserve(false)}>
            <motion.div
              role="dialog"
              aria-label="Observability"
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="scrollbar-thin h-full overflow-y-auto rounded-cards border border-hairline bg-parchment"
            >
              <Suspense fallback={<div className="p-8 text-body text-graphite">Đang tải…</div>}>
                <ObservabilityPage onClose={() => setObserve(false)} />
              </Suspense>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
