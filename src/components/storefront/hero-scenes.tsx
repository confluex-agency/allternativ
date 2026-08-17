"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// The golden hour hero: three frames from the same rooftop, cross-fading.
//
// The three scenes are deliberately composed the same way — the model sits to
// the right of centre and the upper left is open sky — so the headline always
// lands on sky and never on a face. That is why the copy needs no dark overlay
// to stay readable, only the soft warm scrim in page.tsx.
//
// The images are AI campaign frames and the eyewear in them is NOT a real
// product, which is why the hero never names a model. They are meant to be
// swapped for a real shoot in the same direction; that is a change of these
// three files and nothing else.

export type HeroScene = {
  src: string;
  alt: string;
};

type Props = {
  scenes: HeroScene[];
  /** How long each frame holds, in milliseconds. */
  interval?: number;
};

export function HeroScenes({ scenes, interval = 6000 }: Props) {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const timer = useRef<number | null>(null);

  // Autoplay is decided on the client and starts switched off, so the server
  // and the first client render agree. Anyone who asked their system not to
  // animate keeps a still hero and drives it with the dots instead.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAutoplay(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!autoplay || scenes.length < 2) return;
    timer.current = window.setInterval(
      () => setCurrent((i) => (i + 1) % scenes.length),
      interval,
    );
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [autoplay, interval, scenes.length]);

  function show(index: number) {
    setCurrent(index);
    // Taking manual control stops the carousel moving under the visitor's hand.
    if (timer.current) window.clearInterval(timer.current);
    setAutoplay(false);
  }

  return (
    <>
      {scenes.map((scene, i) => (
        <Image
          key={scene.src}
          src={scene.src}
          alt={i === 0 ? scene.alt : ""}
          aria-hidden={i === 0 ? undefined : true}
          fill
          priority={i === 0}
          sizes="100vw"
          // The subject sits right of centre, so a narrow screen crops from the
          // left and keeps him in frame. Wide screens show the whole rooftop.
          className={`object-cover object-[70%_center] sm:object-center transition-opacity duration-[1400ms] ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Bottom right, because the calls to action own the bottom left. */}
      {scenes.length > 1 && (
        <div className="absolute bottom-6 right-5 z-20 flex gap-2 md:bottom-10 md:right-12">
          {scenes.map((scene, i) => (
            <button
              key={scene.src}
              type="button"
              onClick={() => show(i)}
              aria-label={`Scene ${i + 1}`}
              aria-current={i === current}
              className={`h-1.5 rounded-full fluid-transition ${
                i === current
                  ? "w-8 bg-brand-ink/70"
                  : "w-4 bg-brand-ink/25 hover:bg-brand-ink/50"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
