import "@fontsource-variable/inter";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";

// "/" is the public landing page; everything else is the app (chat at /chat).
const Landing = lazy(() => import("./landing/Landing"));
const App = lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<div className="h-full bg-[#fdfcfb]" />}>
              <Landing />
            </Suspense>
          }
        />
        <Route
          path="/*"
          element={
            <Suspense fallback={<div className="h-full bg-parchment" />}>
              <App />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
