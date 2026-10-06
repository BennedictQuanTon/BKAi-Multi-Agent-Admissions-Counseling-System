import "@fontsource-variable/inter";
import "@fontsource/instrument-sans/500.css";
import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { Closing, Footer, Testimonials } from "./Closing";
import Features from "./Features";
import Hero from "./Hero";
import Maker from "./Maker";
import Metrics from "./Metrics";
import Nav from "./Nav";
import Showcase from "./Showcase";
import Story from "./Story";

/** Public landing page at "/". "Try it" opens the app at /chat. */
export default function Landing() {
  useEffect(() => {
    const prev = document.title;
    document.title = "BKAi — Admissions answers, grounded in the source";
    return () => {
      document.title = prev;
    };
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <div className="lp">
        <a href="#story" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-lp-canvas focus:px-4 focus:py-2 focus:shadow">
          Skip to content
        </a>
        <Nav />
        <main>
          <Hero />
          <Maker />
          <Story />
          <Showcase />
          <Features />
          <Metrics />
          <Testimonials />
          <Closing />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
