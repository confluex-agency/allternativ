"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
// Its own prop shape on purpose: this is a prototype, and tying it to the
// catalogue's types means every catalogue change drags it along.
export type StripProduct = {
  name: string;
  colorways: {
    key: string;
    name: string;
    /** CSS colour for the pill's dot. */
    swatch?: string;
    gallery: string[];
  }[];
};

// "Studio Strip" — the shoot's 8-9 angles as a snap-scrolling filmstrip.
//
// Why a strip and not a turntable: these are editorial angles, each with its own
// framing and light. Crossfading them reads as flicker because the eye expects
// continuity it never gets. Snapped one-per-screen, the same photos read as
// deliberate — nobody expects frame N to continue frame N-1 when they swipe.
//
// Native CSS scroll-snap does the work; no drag handlers, no animation library.
// That also means it keeps momentum scrolling on iOS for free.

// Los frames no llevan color de fondo: cada foto ya trae el suyo, y pintar el
// contenedor dejaba un segundo rectangulo a la vista.

export function StudioStrip({ product }: { product: StripProduct }) {
  const [colorwayKey, setColorwayKey] = useState(product.colorways[0].key);
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  const colorway =
    product.colorways.find((c) => c.key === colorwayKey) ?? product.colorways[0];

  // Track which frame is centred so the dots stay honest.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const first = rail.firstElementChild as HTMLElement | null;
        if (!first) return;
        // Slides are uniform, so index = scrollLeft / slide pitch.
        const pitch = first.offsetWidth + 12; // 12px = gap-3
        setActive(Math.round(rail.scrollLeft / pitch));
      });
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      rail.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Changing colourway restarts the strip: frame 3 of silver and frame 3 of
  // black aren't the same shot, so holding the index would look like a glitch.
  const pickColorway = (key: string) => {
    setColorwayKey(key);
    setActive(0);
    railRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  return (
    <section className="py-20 md:py-32">
      <div className="mx-auto mb-8 max-w-[1440px] px-5 md:mb-12 md:px-12">
        <p className="eyebrow text-brand-muted mb-4">02 — studio angles</p>
        <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
          Every side of the signal.
        </h2>
        <p className="mt-4 max-w-sm text-sm text-brand-ink-soft">
          Swipe through the shoot. {colorway.name}, {colorway.gallery.length}{" "}
          angles.
        </p>
      </div>

      {/* Rail — full-bleed so the next frame peeks in and invites the swipe */}
      <div
        ref={railRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-4 md:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {colorway.gallery.map((src, i) => (
          <div
            key={src}
            className="relative aspect-[4/3] w-[82%] shrink-0 snap-center overflow-hidden rounded-[1.25rem] md:w-[46%] lg:w-[32%]"
          >
            <Image
              src={src}
              alt={`${product.name} — ${colorway.name}, angle ${i + 1}`}
              fill
              // Only the first frame is worth eager work; the rest arrive as you swipe.
              loading={i === 0 ? "eager" : "lazy"}
              sizes="(max-width: 768px) 82vw, (max-width: 1024px) 46vw, 32vw"
              className="object-contain p-4 md:p-8"
            />
            <span className="absolute left-4 top-4 eyebrow text-[10px] text-brand-ink/40">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-6 flex max-w-[1440px] items-center justify-between gap-6 px-5 md:px-12">
        {/* Dots */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {colorway.gallery.map((src, i) => (
            <span
              key={src}
              className={`h-1 rounded-full fluid-transition ${
                i === active ? "w-5 bg-brand-ink" : "w-1 bg-brand-ink/20"
              }`}
            />
          ))}
        </div>

        {/* Colourway pills — only when there's a real choice */}
        {product.colorways.length > 1 && (
          <div className="flex gap-2">
            {product.colorways.map((c) => {
              const on = c.key === colorwayKey;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pickColorway(c.key)}
                  aria-pressed={on}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 eyebrow fluid-transition ${
                    on
                      ? "border-brand-ink bg-brand-ink text-brand-beige"
                      : "border-brand-ink/15 text-brand-ink-soft hover:border-brand-ink"
                  }`}
                >
                  <span
                    className="size-2.5 rounded-full ring-1 ring-brand-ink/15"
                    style={{ backgroundColor: c.swatch }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
