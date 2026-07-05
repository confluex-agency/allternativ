"use client";

import Image from "next/image";
import { useState } from "react";
import { Box } from "lucide-react";
import { GlassesViewerLazy } from "@/components/storefront/glasses-viewer-lazy";
import type { ProductAngle } from "@/lib/mock-data";

// Editorial product gallery. Leads with real photography (fast, always looks
// good), and offers the interactive 3D model as a "reveal" — the one thing a
// flat catalogue can't do. Switching into 3D sweeps a prism-light burst.

type Props = {
  name: string;
  tintClass: string;
  gallery: ProductAngle[];
  has3D: boolean;
};

export function ProductGallery({ name, tintClass, gallery, has3D }: Props) {
  const [mode, setMode] = useState<"photo" | "3d">("photo");
  const [active, setActive] = useState(0);
  // Bumped every time we enter 3D so the flash keyframe re-fires.
  const [flashKey, setFlashKey] = useState(0);

  function showPhoto(index: number) {
    setMode("photo");
    setActive(index);
  }

  function show3D() {
    setMode("3d");
    setFlashKey((k) => k + 1);
  }

  const hasPhotos = gallery.length > 0;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Hero frame */}
      <div
        className={`group relative aspect-[16/10] overflow-hidden rounded-[1.5rem] md:rounded-[2rem] ${tintClass}`}
      >
        {/* Photo layers — crossfade between angles */}
        {hasPhotos &&
          gallery.map((angle, i) => (
            <Image
              key={angle.src}
              src={angle.src}
              alt={`${name} — ${angle.label}`}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 100vw, 60vw"
              className={`object-cover fluid-transition group-hover:scale-[1.03] ${
                mode === "photo" && active === i ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}

        {/* Empty state — no shoot yet */}
        {!hasPhotos && mode === "photo" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <p className="eyebrow text-brand-ink/30">photography soon</p>
              <p className="mt-2 text-[11px] text-brand-ink/40 md:text-xs">
                studio shoot lands with the production team
              </p>
            </div>
          </div>
        )}

        {/* 3D reveal */}
        {mode === "3d" && (
          <>
            <GlassesViewerLazy className="reveal-3d absolute inset-0 h-full w-full !rounded-none" />
            {/* The "PUM" — a single prism-light sweep. GlassesViewer already
                renders its own "drag to rotate" hint, so we don't repeat it. */}
            <div
              key={flashKey}
              aria-hidden="true"
              className="prism-flash pointer-events-none absolute inset-0 z-10 mix-blend-screen"
              style={{
                background:
                  "conic-gradient(from 210deg at 50% 50%, var(--brand-rose), var(--brand-mint), var(--brand-sky), var(--brand-rose))",
              }}
            />
          </>
        )}

        {/* Angle caption (photo mode) */}
        {hasPhotos && mode === "photo" && (
          <span className="eyebrow pointer-events-none absolute bottom-3 left-4 text-[10px] text-brand-ink/40">
            {gallery[active].label}
          </span>
        )}
      </div>

      {/* Thumbnail rail */}
      <div className="grid grid-cols-5 gap-2 md:grid-cols-6 md:gap-3">
        {gallery.map((angle, i) => {
          const isActive = mode === "photo" && active === i;
          return (
            <button
              key={angle.src}
              type="button"
              onClick={() => showPhoto(i)}
              aria-label={`View ${angle.label}`}
              aria-pressed={isActive}
              className={`relative aspect-square overflow-hidden rounded-[0.6rem] md:rounded-[0.85rem] fluid-transition ${tintClass} ${
                isActive
                  ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-brand-beige"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={angle.src}
                alt=""
                fill
                sizes="15vw"
                className="object-cover"
              />
            </button>
          );
        })}

        {/* The 3D thumb — the surprise the catalogue can't show */}
        {has3D && (
          <button
            type="button"
            onClick={show3D}
            aria-label="View in 3D"
            aria-pressed={mode === "3d"}
            className="group relative grid aspect-square place-items-center overflow-hidden rounded-[0.6rem] p-[2px] md:rounded-[0.85rem]"
            style={{
              background:
                "conic-gradient(from 200deg at 50% 50%, var(--brand-rose), var(--brand-mint), var(--brand-sky), var(--brand-rose))",
            }}
          >
            <span
              className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-[0.5rem] md:rounded-[0.72rem] fluid-transition ${
                mode === "3d"
                  ? "bg-brand-ink text-brand-beige"
                  : "bg-brand-beige text-brand-ink group-hover:bg-white"
              }`}
            >
              <Box size={16} strokeWidth={1.5} />
              <span className="eyebrow text-[9px] leading-none">3D</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
