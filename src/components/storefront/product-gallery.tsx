"use client";

import Image from "next/image";
import { useState } from "react";
import type { Colorway } from "@/lib/mock-data";

// Editorial product gallery: a big hero angle, a thumbnail rail of every angle,
// and a colourway selector that swaps the whole photo set. Photos only — the 3D
// viewer comes later.

// Uniform studio surface so the lens floats with air around it (contain, not
// cover) — no cropped temples.
const STUDIO_BG = "bg-[#e9edf3]";

type Props = {
  name: string;
  colorways: Colorway[];
};

export function ProductGallery({ name, colorways }: Props) {
  const [cwIndex, setCwIndex] = useState(0);
  const [angle, setAngle] = useState(0);

  const colorway = colorways[cwIndex];
  const gallery = colorway.gallery;

  function pickColorway(i: number) {
    setCwIndex(i);
    setAngle(0);
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Hero frame */}
      <div
        className={`group relative aspect-[4/3] overflow-hidden rounded-[1.5rem] p-4 md:rounded-[2rem] md:p-8 ${STUDIO_BG}`}
      >
        {gallery.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`${name} ${colorway.name} — vista ${i + 1}`}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 60vw"
            className={`object-contain transition-opacity duration-300 ${
              i === angle ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {colorways.length > 1 && (
          <span className="eyebrow pointer-events-none absolute bottom-3 left-4 rounded-full bg-brand-ink/70 px-3 py-1 text-[10px] text-brand-beige backdrop-blur">
            {colorway.name}
          </span>
        )}
      </div>

      {/* Thumbnail rail */}
      <div className="grid grid-cols-5 gap-2 md:grid-cols-6 md:gap-3">
        {gallery.map((src, i) => {
          const isActive = i === angle;
          return (
            <button
              key={src}
              type="button"
              onClick={() => setAngle(i)}
              aria-label={`Vista ${i + 1}`}
              aria-pressed={isActive}
              className={`relative aspect-square overflow-hidden rounded-[0.6rem] p-1 md:rounded-[0.85rem] fluid-transition ${STUDIO_BG} ${
                isActive
                  ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-brand-beige"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={src} alt="" fill sizes="15vw" className="object-contain" />
            </button>
          );
        })}
      </div>

      {/* Colourway selector */}
      {colorways.length > 1 && (
        <div className="pt-2">
          <p className="eyebrow text-brand-muted mb-3">
            Color — {colorway.name}
          </p>
          <div className="flex gap-3">
            {colorways.map((c, i) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pickColorway(i)}
                aria-pressed={i === cwIndex}
                className="flex items-center gap-2"
              >
                <span
                  className={`grid size-9 place-items-center rounded-full fluid-transition ${
                    i === cwIndex
                      ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-brand-beige"
                      : "ring-1 ring-brand-ink/15 hover:ring-brand-ink/40"
                  }`}
                >
                  <span
                    className="size-7 rounded-full"
                    style={{ backgroundColor: c.swatch }}
                  />
                </span>
                <span
                  className={`text-sm fluid-transition ${
                    i === cwIndex ? "text-brand-ink" : "text-brand-muted"
                  }`}
                >
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
