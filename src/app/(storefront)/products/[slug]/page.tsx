import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  mockProducts,
  tintToClass,
  formatMockPrice,
} from "@/lib/mock-data";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = mockProducts.find((p) => p.slug === slug);
  if (!product) return { title: "Not Found" };
  return {
    title: `${product.name} — ${product.tagline}`,
    description: `Allternativ ${product.name}. ${product.tagline}.`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = mockProducts.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 pb-28 md:px-6 md:py-20 md:pb-20 lg:px-12 lg:py-32">
      <nav className="mb-8 eyebrow text-brand-muted md:mb-12">
        <Link href="/products" className="fluid-transition hover:text-brand-ink">
          ← Back to catalogue
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <div className="space-y-3 md:space-y-4">
          <div
            className={`relative aspect-square overflow-hidden rounded-[1.5rem] md:rounded-[2rem] ${tintToClass[product.tint]}`}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(at 60% 30%, rgba(255,255,255,0.6), transparent 65%)",
                mixBlendMode: "screen",
              }}
            />
            <div className="absolute inset-0 grid place-items-center p-6">
              <div className="text-center">
                <p className="eyebrow text-brand-ink/30">placeholder</p>
                <p className="mt-2 text-[11px] text-brand-ink/40 md:text-xs">
                  visor 3D se habilita cuando lleguen los modelos
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["rose", "mint", "sky", "beige"] as const).map((tint) => (
              <div
                key={tint}
                className={`aspect-square rounded-[0.75rem] opacity-60 md:rounded-[1rem] ${tintToClass[tint]}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow text-brand-muted mb-3 md:mb-4">
            {product.type.replace("_", " ")}
          </p>
          <h1 className="display text-[clamp(2.5rem,7vw,4rem)] text-brand-ink">
            {product.name}
          </h1>
          <p className="mt-2 text-base italic text-brand-ink-soft md:mt-3 md:text-lg">
            {product.tagline}
          </p>

          <p className="mt-8 text-2xl text-brand-ink md:mt-10">
            {formatMockPrice(product.priceCents)}
            {product.compareAtPriceCents && (
              <span className="ml-3 text-base text-brand-muted line-through">
                {formatMockPrice(product.compareAtPriceCents)}
              </span>
            )}
          </p>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-brand-ink-soft md:mt-10 md:text-base">
            Diseñado para sesiones largas de escucha y paisajes en
            movimiento. Marco ligero de acetato con acabado mate y lentes
            tratadas con filtro tornasol propio de la casa.
          </p>

          <dl className="mt-8 space-y-3 text-sm md:mt-10">
            <Spec label="Type" value={product.type.replace("_", " ")} />
            <Spec label="Frame" value="Acetato italiano mate" />
            <Spec label="Lens" value="Mineral — filtro tornasol" />
            <Spec label="Origin" value="Handcrafted · LATAM" />
          </dl>

          <button
            type="button"
            disabled
            className="mt-10 hidden min-h-11 w-full rounded-full bg-brand-ink/60 px-7 py-4 eyebrow text-brand-beige cursor-not-allowed md:mt-12 md:block"
          >
            Pronto disponible
          </button>
          <p className="mt-3 hidden text-xs text-brand-muted md:block">
            Mock preview — el carrito se activa cuando conectemos la base y
            lleguen los modelos reales.
          </p>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-brand-ink/10 p-4 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-brand-muted">{product.name}</p>
            <p className="text-base text-brand-ink">
              {formatMockPrice(product.priceCents)}
            </p>
          </div>
          <button
            type="button"
            disabled
            className="min-h-11 rounded-full bg-brand-ink/60 px-6 py-3 eyebrow text-brand-beige cursor-not-allowed"
          >
            Pronto disponible
          </button>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-brand-ink/10 pb-3 md:gap-4">
      <dt className="eyebrow w-20 shrink-0 text-brand-muted md:w-24">{label}</dt>
      <dd className="break-words text-brand-ink-soft">{value}</dd>
    </div>
  );
}
