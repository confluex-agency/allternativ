"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HeroVideoLazy } from "@/components/storefront/hero-video-lazy";

// "The Pull-Back" — the hero and the product live on ONE pinned stage that
// morphs as you scroll: the camera pulls back off Manuel's face and the lens he
// was wearing floats forward. Doing it in a single stage (instead of a hero
// section followed by a product section) buys two things:
//
//  - No seam. The head never freezes or re-mounts mid-transition.
//  - One <HeroVideo>. A second instance would decode the same alpha video
//    twice, which on a phone is the expensive part.
//
// The lens is the SILVER colourway on purpose: it's the one on his face, so the
// eye tracks it as the same object. Swapping it for black breaks the thread.
//
// Photos, not a turntable — /catalog/orbital/spin/ is the editorial angles
// reordered, so rotating them flickers. Here the lens only scales and fades.

const LENS_SILVER = "/catalog/orbital-silver/orbital-silver-1.png";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// Map v from [a,b] onto [0,1], clamped. Keeps the timings below readable.
const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a), 0, 1);

export function PullbackStage() {
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
        const total = el.offsetHeight - window.innerHeight;
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

  // Timeline. The head holds a beat before it goes, so the first flick of
  // scroll doesn't feel like it's yanking the hero away.
  const heroCopyOut = 1 - range(progress, 0.02, 0.22);
  const headOut = 1 - range(progress, 0.14, 0.46);
  const skyOut = 1 - range(progress, 0.1, 0.55); // iridescent → brand-beige
  const lensIn = range(progress, 0.3, 0.62);
  const titleIn = range(progress, 0.5, 0.72);
  const ctaIn = range(progress, 0.68, 0.86);

  return (
    <div ref={trackRef} className="relative h-[260vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-brand-beige">
        {/* Iridescent sky — dissolves to the flat beige the rest of the page sits on */}
        <div className="absolute inset-0" style={{ opacity: skyOut }}>
          <Image
            src="/brand/hero-iridescent-sky.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-brand-beige/10 via-brand-beige/30 to-brand-beige"
          />
        </div>

        {/* Head — one instance, pinned right, fades as the camera pulls back */}
        <div
          className="absolute right-0 top-0 h-full w-[62%] sm:w-[46%] md:w-[38%]"
          style={{ opacity: headOut }}
        >
          <HeroVideoLazy />
        </div>

        {/* Hero copy — leaves first */}
        <div
          className="absolute inset-x-0 top-[18%] px-5 md:px-12"
          style={{
            opacity: heroCopyOut,
            transform: `translateY(${(1 - heroCopyOut) * -16}px)`,
          }}
        >
          <p className="eyebrow text-brand-ink-soft mb-4">
            SS&apos;26 — frequency collection
          </p>
          <h1 className="display text-[clamp(2.75rem,11vw,7rem)] text-brand-ink">
            escape
            <br />
            the ordinary.
          </h1>
          <p className="mt-6 text-sm italic text-brand-ink-soft md:text-base">
            A frequency you can wear.
          </p>
        </div>

        {/* The lens itself — arrives as the face leaves */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-[4/3] w-[88vw] max-w-[860px] -translate-x-1/2 -translate-y-1/2 md:w-[62vw]"
          style={{
            opacity: lensIn,
            transform: `translate(-50%, -50%) scale(${1.18 - lensIn * 0.18})`,
          }}
        >
          <Image
            src={LENS_SILVER}
            alt="Orbital in silver"
            fill
            sizes="(max-width: 768px) 88vw, 62vw"
            className="object-contain"
            style={{ filter: "drop-shadow(0 24px 40px rgba(35,25,15,0.18))" }}
          />
        </div>

        {/* Eyebrow for the new section — appears once the sky is gone */}
        <p
          className="absolute left-5 top-6 eyebrow text-brand-muted md:left-12 md:top-10"
          style={{ opacity: titleIn }}
        >
          01 — product identity
        </p>

        {/* Payoff copy */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[22%] px-6 text-center"
          style={{
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 20}px)`,
          }}
        >
          <h2 className="display chromatic-title text-[clamp(1.75rem,5.5vw,3.75rem)] text-brand-ink">
            The same frequency.
            <br />
            Now closer.
          </h2>
          <p className="mt-4 text-sm text-brand-ink-soft">
            Orbital in silver. The one he was wearing.
          </p>
        </div>

        {/* CTA */}
        <div
          className="absolute bottom-[9%] left-1/2 -translate-x-1/2"
          style={{
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * 14}px)`,
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
