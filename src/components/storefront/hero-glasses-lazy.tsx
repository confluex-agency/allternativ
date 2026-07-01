"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroGlasses = dynamic(
  () => import("./hero-glasses").then((mod) => mod.HeroGlasses),
  { ssr: false }
);

// Only mount (and therefore only download the 5.8MB GLB) on real desktop
// pointers. Mobile is data-sensitive (IG/TikTok traffic) and gets the flat
// hero instead — the real product photo will live there later.
export function HeroGlassesLazy() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const sync = () => setShow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!show) return null;
  return <HeroGlasses />;
}
