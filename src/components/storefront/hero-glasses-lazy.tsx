"use client";

import dynamic from "next/dynamic";

// ssr:false so the WebGL canvas only runs client-side. Mounts on every device
// (desktop + mobile) — the client wants the spinning glasses visible everywhere.
const HeroGlasses = dynamic(
  () => import("./hero-glasses").then((mod) => mod.HeroGlasses),
  { ssr: false }
);

export function HeroGlassesLazy() {
  return <HeroGlasses />;
}
