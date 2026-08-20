import Link from "next/link";
import Image from "next/image";
import {
  cardImages,
  fillsFrame,
  isSoldOut,
  type CatalogProduct,
} from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";

// One card, used by the home grid and by the catalogue. It used to be copied in
// both places, which is how the two drifted apart.
//
// Section 05 of the brief: clean product image by default, the photo of someone
// wearing them on hover, colourway dots under the name. The frame carries no
// background colour of its own — every studio photo already brings one, and
// painting the container left a second rectangle showing.

type Props = {
  product: CatalogProduct;
  /** Bigger type and image for the featured slot in the home bento grid. */
  featured?: boolean;
  priority?: boolean;
  /** Grid placement from the parent (column spans and the like). */
  className?: string;
};

export function ProductCard({
  product,
  featured = false,
  priority,
  className = "",
}: Props) {
  const { base, hover } = cardImages(product);
  if (!base) return null;
  const soldOut = isSoldOut(product);

  // A studio shot sits inside the card with air around it; a photo of a person
  // wearing them fills the frame instead.
  const objectFit = fillsFrame(base) ? "object-cover" : "object-contain";

  return (
    <Link
      href={`/products/${product.slug}`}
      className={`group ${featured ? "flex flex-col" : "block"} ${className}`}
    >
      <div
        className={`relative overflow-hidden rounded-[1.25rem] fluid-transition group-hover:-translate-y-1 md:rounded-[1.5rem] ${
          featured ? "aspect-[16/10] flex-1 lg:aspect-auto" : "aspect-[4/3]"
        } ${fillsFrame(base) ? "bg-brand-ink/5" : featured ? "p-6 md:p-10" : "p-3 md:p-5"}`}
      >
        <Image
          src={base.url}
          alt={base.altText ?? product.name}
          fill
          priority={priority}
          sizes={
            featured
              ? "(max-width: 768px) 100vw, 50vw"
              : "(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
          }
          className={`${objectFit} fluid-transition group-hover:scale-[1.03] ${
            hover ? "group-hover:opacity-0" : ""
          }`}
        />

        {hover && (
          <Image
            src={hover.url}
            alt=""
            aria-hidden="true"
            fill
            sizes={
              featured
                ? "(max-width: 768px) 100vw, 50vw"
                : "(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            }
            className={`${
              fillsFrame(hover) ? "object-cover" : "object-contain"
            } opacity-0 fluid-transition group-hover:opacity-100`}
          />
        )}

        {/* Light sheen on hover — reads like a real photo catch-light. */}
        {!hover && (
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-0 group-hover:opacity-100 fluid-transition"
            style={{
              background:
                "radial-gradient(at 50% 40%, rgba(255,255,255,0.55), transparent 70%)",
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* Sold out stays on the grid, marked. The client asked for this
            explicitly: a piece that vanishes takes its demand signal with it. */}
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-ink/85 px-2.5 py-1 eyebrow text-[9px] text-brand-beige backdrop-blur md:left-3 md:top-3">
            Sold out
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-2 md:mt-5">
        <div className="min-w-0">
          <h3
            className={`truncate text-brand-ink ${
              featured ? "text-base md:text-xl" : "text-sm md:text-base"
            }`}
          >
            {product.name}
          </h3>
          {product.tagline && (
            <p className="mt-1 truncate text-xs text-brand-muted">
              {product.tagline}
            </p>
          )}

          {/* Under the name, which is where section 05 puts them. They used to
              float over the photo's bottom corner, where a pale swatch on a
              pale studio background was close to invisible. A sold-out
              colourway keeps its dot, hollowed out rather than removed. */}
          {product.variants.length > 1 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {product.variants.map((v) => (
                <li
                  key={v.id}
                  title={`${v.colorName}${v.inStock ? "" : " — sold out"}`}
                  className={`size-3 rounded-full ring-1 ring-brand-ink/20 ${
                    v.inStock ? "" : "opacity-35"
                  }`}
                  style={{ backgroundColor: v.swatch ?? "#ccc" }}
                >
                  <span className="sr-only">
                    {v.colorName}
                    {v.inStock ? "" : " (sold out)"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="whitespace-nowrap text-xs text-brand-ink md:text-sm">
          {formatPrice(product.priceCents)}
          {product.compareAtPriceCents && (
            <span className="ml-1 hidden text-xs text-brand-muted line-through md:inline">
              {formatPrice(product.compareAtPriceCents)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
