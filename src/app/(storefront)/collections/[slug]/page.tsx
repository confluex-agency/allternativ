import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import {
  getCollectionBySlug,
  isSoldOut,
} from "@/lib/catalog";
import { ProductCard } from "@/components/storefront/product-card";

// The collection landing, section 05 of the client brief.
//
// "Each launch has its own visual identity, editorial introduction, campaign
// image/video and product grid." This is the shop's main entry point per
// section 02, which is why /products and /catalogo both redirect here.
//
// Everything on the page comes from the `Collection` row, so a second drop is a
// row and not a deploy. Nothing is hardcoded, which is exactly what the page it
// replaced got wrong: /catalogo was nine tiles and a headline written for one
// model that no longer exists under that name.

export const revalidate = 60;

// Deliberately empty: nothing is pre-rendered at build time.
//
// Hostinger builds the app in a container that cannot reach MySQL. It is not a
// firewall rule we can open -- the port is not routable from there at all, and
// a build that queries the catalogue dies before it finishes.
//
// Returning an empty array is the documented way to say "generate every path
// on the first visit and cache it from then on" (Next.js, generateStaticParams
// -> "All paths at runtime"). The `revalidate` above still governs freshness,
// so the shop behaves exactly as before; only the build stops depending on the
// database.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return {};
  return {
    title: collection.metaTitle ?? collection.name,
    description: collection.metaDescription ?? collection.tagline ?? undefined,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const available = collection.products.filter((p) => !isSoldOut(p)).length;

  return (
    <div className="flex flex-col">
      {/* ── Collection landing ───────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1440px] px-5 pt-12 md:px-6 md:pt-16 lg:px-12">
        {collection.heroImageUrl && (
          <div className="relative mb-10 aspect-[4/5] overflow-hidden rounded-[1.5rem] sm:aspect-[16/9] md:mb-16 md:rounded-[2rem] lg:aspect-[21/9]">
            {/* A video wins when the client has supplied one: the brief asks for
                "campaign image/video" and a drop film is the stronger opener.
                The still stays as the poster, so there is never a black box
                while it loads and nothing breaks if it fails. */}
            {collection.heroVideoUrl ? (
              <video
                src={collection.heroVideoUrl}
                poster={collection.heroImageUrl}
                autoPlay
                muted
                loop
                playsInline
                className="size-full object-cover"
              />
            ) : (
              <Image
                src={collection.heroImageUrl}
                alt={`${collection.name} campaign`}
                fill
                priority
                sizes="100vw"
                data-framing="collection-hero"
                data-framing-label="05 — collection hero"
                className="object-cover"
              />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-brand-ink/55 via-transparent to-transparent"
            />
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-12 md:items-end md:gap-12">
          <div className="md:col-span-7">
            <p className="eyebrow text-brand-muted mb-3 md:mb-4">
              {collection.name}
            </p>
            {collection.tagline && (
              <h1 className="display text-[clamp(2.25rem,7vw,5rem)] leading-[1.02] text-brand-ink">
                {collection.tagline}
              </h1>
            )}
          </div>

          {collection.description && (
            <p className="md:col-span-5 max-w-xl text-base leading-relaxed text-brand-ink-soft md:text-lg">
              {collection.description}
            </p>
          )}
        </div>
      </section>

      {/* ── Product grid ─────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1440px] px-5 pb-20 pt-10 md:px-6 md:pb-32 md:pt-14 lg:px-12">
        <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-brand-ink/10 pb-4 md:mb-10">
          <p className="eyebrow text-brand-muted">
            {collection.products.length}{" "}
            {collection.products.length === 1 ? "model" : "models"}
          </p>
          {/* Only worth saying when it is not the whole grid. */}
          {available < collection.products.length && (
            <p className="eyebrow text-brand-muted">{available} available</p>
          )}
        </div>

        {collection.products.length === 0 ? (
          <p className="py-24 text-center text-brand-muted">
            This drop has no pieces yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {collection.products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={i < 4}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Closing ──────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1440px] px-5 pb-20 md:px-6 md:pb-28 lg:px-12">
        <div className="glass flex flex-col items-start gap-6 rounded-[1.5rem] p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="display text-[clamp(1.5rem,3.5vw,2.4rem)] text-brand-ink">
              Not just eyewear —
              <span className="italic font-light"> a shift in frequency.</span>
            </h2>
            <p className="mt-3 max-w-md text-brand-ink-soft">
              Every pair ships in an Allternativ case, in black or white.
            </p>
          </div>
          <Link
            href="/frequency"
            className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
          >
            Enter the frequency
            <ArrowUpRight
              size={16}
              className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </section>
    </div>
  );
}
