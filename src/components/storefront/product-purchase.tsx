"use client";

import { useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import {
  CASE_COLORS,
  CASE_SWATCH,
  DEFAULT_CASE_COLOR,
  caseLabel,
  cartLineId,
  type CaseColor,
} from "@/lib/product-options";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { trackAddToCart } from "@/lib/tracking";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { Button } from "@/components/ui/button";

// The purchase area of a product page (section 07 of the brief). Gallery,
// colourway selector, case selector and add-to-cart live together because they
// share one piece of state: what the visitor is actually about to buy.

type Props = {
  product: CatalogProduct;
  /** Images per variant, already in the order the brief asks for. */
  galleries: Record<string, CatalogProduct["variants"][number]["images"]>;
};

export function ProductPurchase({ product, galleries }: Props) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [caseColor, setCaseColor] = useState<CaseColor>(DEFAULT_CASE_COLOR);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCart((s) => s.addItem);

  const variant =
    product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  const images = useMemo(
    () => (variant ? (galleries[variant.id] ?? variant.images) : []),
    [variant, galleries],
  );

  if (!variant) {
    return (
      <p className="text-sm text-brand-muted">
        This model is not available at the moment.
      </p>
    );
  }

  function handleAdd() {
    if (!variant) return;
    const image = images[0]?.url ?? "";
    addItem({
      lineId: cartLineId(variant.id, caseColor),
      variantId: variant.id,
      productId: product.id,
      sku: variant.sku,
      name: product.name,
      variantName: variant.colorName,
      slug: product.slug,
      caseColor,
      priceCents: variant.priceCents,
      quantity: 1,
      imageUrl: image,
    });
    trackAddToCart(variant.sku, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  }

  const multiColour = product.variants.length > 1;

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        <ProductGallery
          name={product.name}
          variantName={variant.colorName}
          images={images}
          showColorBadge={multiColour}
        />

        <div className="lg:pt-2">
          <p className="eyebrow text-brand-muted mb-4">
            {product.code ? (
              <>
                model {product.code}
                <span className="mx-2 text-brand-ink/20">/</span>
              </>
            ) : null}
            {variant.sku}
          </p>

          <h1 className="display text-[clamp(2.75rem,7vw,4.75rem)] text-brand-ink">
            {product.name}
          </h1>
          {product.tagline && (
            <p className="mt-3 text-base italic text-brand-ink-soft md:text-lg">
              {product.tagline}
            </p>
          )}

          <p className="mt-8 text-2xl text-brand-ink md:mt-10">
            {formatPrice(variant.priceCents)}
            {product.compareAtPriceCents && (
              <span className="ml-3 text-base text-brand-muted line-through">
                {formatPrice(product.compareAtPriceCents)}
              </span>
            )}
          </p>

          {product.description && (
            <p className="mt-8 max-w-md text-sm leading-relaxed text-brand-ink-soft md:mt-10 md:text-base">
              {product.description}
            </p>
          )}

          {/* Colourway */}
          {multiColour && (
            <div className="mt-10">
              <p className="eyebrow text-brand-muted mb-3">
                Colour — {variant.colorName}
              </p>
              <div className="flex flex-wrap gap-3">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    aria-pressed={v.id === variant.id}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={`grid size-9 place-items-center rounded-full fluid-transition ${
                        v.id === variant.id
                          ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-brand-beige"
                          : "ring-1 ring-brand-ink/15 hover:ring-brand-ink/40"
                      }`}
                    >
                      <span
                        className="size-7 rounded-full"
                        style={{ backgroundColor: v.swatch ?? "#ccc" }}
                      />
                    </span>
                    <span
                      className={`text-sm fluid-transition ${
                        v.id === variant.id
                          ? "text-brand-ink"
                          : "text-brand-muted"
                      }`}
                    >
                      {v.colorName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Case (section 10: "Your frequency, your way") */}
          <div className="mt-8">
            <p className="eyebrow text-brand-muted mb-3">
              Case — {caseLabel(caseColor)}
            </p>
            <div className="flex flex-wrap gap-3">
              {CASE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCaseColor(c)}
                  aria-pressed={c === caseColor}
                  className="flex items-center gap-2"
                >
                  <span
                    className={`grid size-9 place-items-center rounded-full fluid-transition ${
                      c === caseColor
                        ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-brand-beige"
                        : "ring-1 ring-brand-ink/15 hover:ring-brand-ink/40"
                    }`}
                  >
                    <span
                      className="size-7 rounded-full ring-1 ring-inset ring-brand-ink/10"
                      style={{ backgroundColor: CASE_SWATCH[c] }}
                    />
                  </span>
                  <span
                    className={`text-sm fluid-transition ${
                      c === caseColor ? "text-brand-ink" : "text-brand-muted"
                    }`}
                  >
                    {caseLabel(c)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Desktop CTA — on mobile the fixed bottom bar takes over. */}
          <div className="mt-8 hidden max-w-md md:mt-10 md:block">
            <AddButton
              inStock={variant.inStock}
              justAdded={justAdded}
              onAdd={handleAdd}
            />
          </div>

          <dl className="mt-10 space-y-3 text-sm md:mt-12">
            <Spec label="Colour" value={variant.colorName} />
            <Spec label="Case" value={caseLabel(caseColor)} />
            <Spec label="Frame" value={product.specs.frame} />
            <Spec label="Lens" value={product.specs.lens} />
            <Spec label="Lens material" value={product.specs.lensMaterial} />
            <Spec label="UV" value={product.specs.uvProtection} />
            <Spec
              label="Lens category"
              value={
                product.specs.lensCategory === null
                  ? null
                  : String(product.specs.lensCategory)
              }
            />
            <Spec label="Dimensions" value={product.specs.dimensions} />
            <Spec
              label="Weight"
              value={
                product.specs.weightGrams === null
                  ? null
                  : `${product.specs.weightGrams} g`
              }
            />
            <Spec label="Fit" value={product.specs.fit} />
            <Spec label="Origin" value={product.specs.origin} />
          </dl>

          {product.feeling && (
            <div className="mt-12 border-t border-brand-ink/10 pt-8">
              <p className="eyebrow text-brand-muted mb-4">The feeling</p>
              <p className="max-w-md text-sm leading-relaxed text-brand-ink-soft md:text-base">
                {product.feeling}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-brand-ink/10 p-4 md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-brand-muted">
              {product.name} · {variant.colorName} · {caseLabel(caseColor)}
            </p>
            <p className="text-base text-brand-ink">
              {formatPrice(variant.priceCents)}
            </p>
          </div>
          <div className="w-40 shrink-0">
            <AddButton
              inStock={variant.inStock}
              justAdded={justAdded}
              onAdd={handleAdd}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function AddButton({
  inStock,
  justAdded,
  onAdd,
}: {
  inStock: boolean;
  justAdded: boolean;
  onAdd: () => void;
}) {
  return (
    <Button
      onClick={onAdd}
      disabled={!inStock}
      className="w-full py-6 text-sm font-medium tracking-wide"
      size="lg"
    >
      {!inStock ? "OUT OF STOCK" : justAdded ? "ADDED" : "ADD TO CART"}
    </Button>
  );
}

/** Renders nothing when the spec has not been confirmed by the client. */
function Spec({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 border-b border-brand-ink/10 pb-3 md:gap-4">
      <dt className="eyebrow w-20 shrink-0 text-brand-muted md:w-24">{label}</dt>
      <dd className="break-words text-brand-ink-soft">{value}</dd>
    </div>
  );
}
