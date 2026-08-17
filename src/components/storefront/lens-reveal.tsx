"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Direction A — the scroll-pinned lens reveal. A tall track pins a full-screen
// stage; scroll progress (0→1) rotates the lens through its real photo angles
// (crossfaded, so it dissolves rather than jumps) while an iridescent halo
// blooms behind it. Real photos → perfect quality, no 3D artifacts.

const FRAMES = [0, 1, 2, 3, 4].map(
  (i) => `/catalog/orbital/spin/black-${i}.webp`
);

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function LensReveal() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = trackRef.current;
        if (!el) return;
        const vh = window.innerHeight;
        const total = el.offsetHeight - vh; // scrollable distance while pinned
        const scrolled = clamp(-el.getBoundingClientRect().top, 0, total);
        setProgress(total > 0 ? scrolled / total : 0);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const frameFloat = progress * (FRAMES.length - 1);
  // Halo blooms as you scroll deeper.
  const haloScale = 0.55 + progress * 0.9;
  const haloOpacity = 0.25 + progress * 0.55;
  const haloRotate = progress * 70;
  // Copy timings.
  const introOut = clamp(1 - progress * 4, 0, 1); // "scroll" hint fades fast
  const titleIn = clamp((progress - 0.15) * 2.2, 0, 1);
  const ctaIn = clamp((progress - 0.72) * 4, 0, 1);

  return (
    <div ref={trackRef} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-[#eef1f5]">
        {/* Iridescent halo — blooms with scroll */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "conic-gradient(from 210deg at 50% 50%, var(--brand-rose), var(--brand-mint), var(--brand-sky), var(--brand-beige), var(--brand-rose))",
            filter: "blur(90px) saturate(1.15)",
            WebkitMaskImage:
              "radial-gradient(closest-side, #000 30%, transparent 78%)",
            maskImage: "radial-gradient(closest-side, #000 30%, transparent 78%)",
            opacity: haloOpacity,
            transform: `translate(-50%, -50%) scale(${haloScale}) rotate(${haloRotate}deg)`,
          }}
        />

        {/* Lens — real photos, crossfaded by scroll progress */}
        <div className="relative aspect-[16/10] w-[92vw] max-w-[1100px] md:w-[80vw]">
          {FRAMES.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt="Orbital"
              fill
              priority={i === 0}
              sizes="90vw"
              draggable={false}
              className="object-contain"
              style={{ opacity: clamp(1 - Math.abs(frameFloat - i), 0, 1) }}
            />
          ))}
        </div>

        {/* Eyebrow */}
        <p className="eyebrow absolute left-5 top-6 text-brand-ink/50 md:left-10 md:top-10">
          01 — Enter the frequency
        </p>

        {/* Scroll hint (fades on first scroll) */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center"
          style={{ opacity: introOut }}
        >
          <p className="eyebrow text-brand-ink/50">scroll</p>
          <p className="mt-1 text-brand-ink/40">↓</p>
        </div>

        {/* Title reveal */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[17%] px-6 text-center"
          style={{
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 24}px)`,
          }}
        >
          <h2 className="display text-[clamp(2rem,6vw,4.5rem)] text-brand-ink">
            A shift in perception.
          </h2>
        </div>

        {/* CTA at the end of the reveal */}
        <div
          className="absolute bottom-[8%] left-1/2 -translate-x-1/2"
          style={{
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * 16}px)`,
            pointerEvents: ctaIn > 0.5 ? "auto" : "none",
          }}
        >
          <Link
            href="/products/orbital"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-ink px-7 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
          >
            Shop Orbital ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
