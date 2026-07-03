"use client";

import dynamic from "next/dynamic";

// ssr:false so the WebGL canvas only runs client-side. The head GLB is ~450KB
// (meshopt), light enough to load on mobile too.
const HeroHead = dynamic(
  () => import("./hero-head").then((mod) => mod.HeroHead),
  { ssr: false }
);

export function HeroHeadLazy() {
  return <HeroHead />;
}
