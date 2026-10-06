import { MotionConfig } from "framer-motion";
import { Closing, Footer, Testimonials } from "./components/Closing";
import Features from "./components/Features";
import Hero from "./components/Hero";
import Maker from "./components/Maker";
import Metrics from "./components/Metrics";
import Nav from "./components/Nav";
import Showcase from "./components/Showcase";
import Story from "./components/Story";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a href="#story" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-canvas focus:px-4 focus:py-2 focus:shadow">
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
    </MotionConfig>
  );
}
