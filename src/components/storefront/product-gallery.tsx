"use client";

import Image from "next/image";
import { useState } from "react";
import type { CatalogImage } from "@/lib/catalog";

// Editorial product gallery: one large angle plus a thumbnail rail. It renders
// whatever set of images it is handed and owns nothing but which angle is on
// screen — the colourway lives in ProductPurchase, because the price and the
// add-to-cart button depend on it too.

// El lente va con aire alrededor (contain, no cover) para no cortar las patillas,
// y sin color de fondo propio: cada foto ya trae el suyo, asi que pintar el
// contenedor dejaba un segundo rectangulo a la vista.

type Props = {
  name: string;
  variantName: string;
  images: CatalogImage[];
  /** Shown over the hero when the model has more than one colourway. */
  showColorBadge?: boolean;
};

export function ProductGallery({
  name,
  variantName,
  images,
  showColorBadge = false,
}: Props) {
  const [angle, setAngle] = useState(0);

  // A colourway with no photography yet. Said in words rather than filled with
  // another colour's photo, which would tell the buyer that is what they get.
  if (images.length === 0) {
    return (
      <div className="relative aspect-[4/3] w-full min-w-0 rounded-[1.5rem] border border-brand-ink/10 md:rounded-[2rem]">
        <p className="eyebrow absolute inset-0 flex items-center justify-center p-8 text-center text-brand-muted">
          Photography of {variantName} is on its way
        </p>
      </div>
    );
  }

  // The rail is keyed by variant so switching colour resets to the first angle
  // instead of keeping an index the new set may not have.
  const current = Math.min(angle, images.length - 1);
  // The badge names the colourway, so it goes only over that colourway's own
  // photos. Over a shared one it would label a photo as a colour it may not be.
  const badge = showColorBadge && images[current]?.variantId !== null;

  return (
    <div className="space-y-3 md:space-y-4" key={variantName}>
      {/* Hero frame */}
      <div className="group relative aspect-[4/3] overflow-hidden rounded-[1.5rem] p-4 md:rounded-[2rem] md:p-8">
        {images.map((img, i) => (
          <Image
            key={img.id}
            src={img.url}
            alt={img.altText ?? `${name} ${variantName} — view ${i + 1}`}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 60vw"
            className={`object-contain transition-opacity duration-300 ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {badge && (
          <span className="eyebrow pointer-events-none absolute bottom-3 left-4 rounded-full bg-brand-ink/70 px-3 py-1 text-[10px] text-brand-beige backdrop-blur">
            {variantName}
          </span>
        )}
      </div>

      {/* Thumbnail rail */}
      <div className="grid grid-cols-5 gap-2 md:grid-cols-6 md:gap-3">
        {images.map((img, i) => {
          const isCurrent = i === current;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setAngle(i)}
              aria-label={`View ${i + 1}`}
              aria-pressed={isCurrent}
              className={`relative aspect-square overflow-hidden rounded-[0.6rem] p-1 md:rounded-[0.85rem] fluid-transition ${
                isCurrent
                  ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-brand-beige"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="15vw"
                className="object-contain"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
