"use client";

import dynamic from "next/dynamic";

// Client-only so the <video> autoplay logic never runs during SSR. Mirrors
// hero-head-lazy so swapping the two in the home page is a one-line change.
const HeroVideo = dynamic(
  () => import("./hero-video").then((mod) => mod.HeroVideo),
  { ssr: false }
);

export function HeroVideoLazy({ fit }: { fit?: "contain" | "cover" }) {
  return <HeroVideo fit={fit} />;
}
