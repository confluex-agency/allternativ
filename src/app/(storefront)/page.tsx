import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLiveProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/storefront/product-card";
import { HeroVideoLazy } from "@/components/storefront/hero-video-lazy";

const LIFESTYLE_MOMENTS = [
  "Summer nights",
  "Raves & festivals",
  "Sunset drives",
  "Late city walks",
  "Moments you don't want to forget",
];

const PRODUCT_PILLARS = [
  { label: "Lightweight", tint: "bg-brand-mint" },
  { label: "Minimal", tint: "bg-brand-sky" },
  { label: "Expressive", tint: "bg-brand-rose" },
];

// The catalogue is editable from the admin, so the page cannot be frozen at
// build time: it rebuilds itself at most once a minute. Prices and stock are
// re-read from the database at checkout regardless, so a stale card can never
// charge the wrong amount.
export const revalidate = 60;

export default async function HomePage() {
  const products = await getLiveProducts();

  return (
    <div className="flex flex-col">
      {/* === HERO === */}
      <section className="relative overflow-hidden sm:min-h-[calc(100dvh-4rem)] md:min-h-[92vh]">
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -left-20 hidden size-[340px] md:size-[520px] holo-conic opacity-60 sm:block"
        />

        {/* ===== MOBILE hero (phones only) — "escape the ordinary" rotated + head
             framed on the right. Tablet/desktop keep the layout further below.
             Positions use %/vw/clamp so it holds across phone sizes. ===== */}
        <div className="relative z-10 sm:hidden">
          <div className="relative h-[44vh] min-h-[384px] overflow-hidden">
            <p className="absolute left-5 top-4 z-20 eyebrow text-brand-ink-soft">
              SS&apos;26 — frequency collection
            </p>
            {/* subtitle, set vertical reading upward */}
            <p className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rotate-180 whitespace-nowrap text-sm italic text-brand-ink-soft [writing-mode:vertical-rl]">
              A frequency you can wear.
            </p>
            {/* Rotated headline. The collage block is a CHILD sized in em, so it
                scales with the clamp font and always sits behind "escape" on every
                phone size — anchored to the text, not the screen. */}
            <div className="absolute left-[25%] top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 -rotate-90">
              <h1 className="display chromatic-title whitespace-nowrap text-[clamp(2.5rem,13.5vw,4rem)] leading-[0.9] text-brand-ink">
                escape
                <br />
                the ordinary.
              </h1>
            </div>
            {/* head floats directly over the iridescent bg (no frame) */}
            <div className="pointer-events-none absolute right-2 top-1/2 z-10 h-[66%] w-[52%] -translate-y-1/2">
              <HeroVideoLazy />
            </div>
          </div>

          <div className="px-5 pb-10 pt-2">
            <p className="max-w-md text-sm leading-relaxed text-brand-ink-soft">
              Eyewear for those who live between music, light and emotion — where
              summer nights feel infinite and daily reality feels optional.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/products"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-ink px-6 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
              >
                Shop the collection
                <ArrowUpRight
                  size={16}
                  className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/frequency"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-brand-ink/20 px-6 eyebrow text-brand-ink fluid-transition hover:border-brand-ink hover:bg-white/50"
              >
                Enter the frequency
              </Link>
            </div>
          </div>
        </div>

        {/* ===== TABLET / DESKTOP hero (sm+) — unchanged ===== */}
        <div className="hidden sm:block">
          <div className="pointer-events-none absolute left-0 right-0 sm:portrait:top-[30%] sm:portrait:bottom-[22%] md:portrait:top-[34%] md:portrait:bottom-[12%] landscape:left-auto landscape:top-0 landscape:bottom-0 landscape:w-[48%] xl:landscape:w-[44%]">
            <HeroVideoLazy />
          </div>

          <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] md:min-h-[92vh] max-w-[1440px] flex-col justify-between gap-12 px-5 pb-16 pt-14 md:pt-32 lg:px-12 lg:pt-44">
            <div className="max-w-[72rem]">
              <p className="eyebrow text-brand-ink-soft mb-5">
                SS&apos;26 — frequency collection
              </p>
              <h1 className="display chromatic-title text-[clamp(3rem,13vw,8rem)] text-brand-ink">
                escape
                <br />
                the ordinary.
              </h1>
              <p className="mt-6 text-lg italic text-brand-ink-soft md:mt-8 md:text-2xl">
                A frequency you can wear.
              </p>
            </div>

            <div className="flex flex-col gap-8 md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-10">
              <p className="max-w-md text-sm leading-relaxed text-brand-ink-soft md:text-base">
                Eyewear for those who live between music, light and emotion —
                where summer nights feel infinite and daily reality feels
                optional.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
                >
                  Shop the collection
                  <ArrowUpRight
                    size={16}
                    className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/frequency"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-ink/20 px-6 py-3 eyebrow text-brand-ink fluid-transition hover:border-brand-ink hover:bg-white/50"
                >
                  Enter the frequency
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === 01 — THE COLLECTION (products, straight after the hero) === */}
      <section className="mx-auto max-w-[1440px] px-5 pb-20 pt-12 md:px-6 md:pb-32 md:pt-16 lg:px-12">
        <div className="mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between md:gap-6">
          <div>
            <p className="eyebrow text-brand-muted mb-3 md:mb-4">
              01 — the collection
            </p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              Five silhouettes.
              <br />
              <span className="italic font-light">One frequency.</span>
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex eyebrow text-brand-ink-soft fluid-transition hover:text-brand-ink"
          >
            Shop all →
          </Link>
        </div>

        {/* Bento: the first piece runs large (2×2), the rest fill a 2×2 beside
            it. On phones the feature becomes a wide banner and the other four
            drop into a 2-up grid below. */}
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {products.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              featured={i === 0}
              priority={i === 0}
              className={i === 0 ? "col-span-2 lg:row-span-2" : ""}
            />
          ))}
        </div>
      </section>

      {/* === 02 — BRAND WORLD === */}
      <section className="relative mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-16">
          <div className="md:col-span-7">
            <p className="eyebrow text-brand-muted mb-5">02 — brand world</p>
            <h2 className="display text-[clamp(2rem,7vw,4.5rem)] text-brand-ink">
              Not just eyewear.
              <br />
              <span className="italic font-light">A shift in perception.</span>
            </h2>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-brand-ink-soft md:mt-10 md:text-lg">
              Allternativ is not just eyewear. It&apos;s a shift in perception.
              We design sunglasses for those who live between music, light and
              emotion — where summer nights feel infinite and daily reality
              feels optional.
            </p>
            <Link
              href="/about"
              className="group mt-8 inline-flex items-center gap-2 eyebrow text-brand-ink fluid-transition hover:text-brand-muted md:mt-10"
            >
              Our story
              <ArrowUpRight
                size={16}
                className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </div>

          <Link
            href="/about"
            className="group relative md:col-span-5 aspect-[4/5] overflow-hidden rounded-[1.5rem] md:rounded-[2rem]"
          >
            <Image
              src="/brand/liquid-iridescent.png"
              alt="Iridescent liquid texture"
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover fluid-transition group-hover:scale-[1.04]"
            />
            <span className="absolute bottom-4 left-4 inline-flex items-center gap-1 eyebrow text-white opacity-0 fluid-transition group-hover:opacity-100 md:bottom-6 md:left-6">
              Read our story
              <ArrowUpRight size={14} />
            </span>
          </Link>
        </div>
      </section>

      {/* === 03 — PRODUCT IDENTITY === */}
      <section className="bg-white/60 py-20 md:py-32 lg:py-48">
        <div className="mx-auto max-w-[1440px] px-5 md:px-6 lg:px-12">
          <div className="max-w-3xl">
            <p className="eyebrow text-brand-muted mb-5">03 — product identity</p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              Designed for movement,
              <br />
              light, and energy.
            </h2>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-brand-ink-soft md:text-lg">
              Every pair is created to be worn in motion — at festivals,
              sunsets, city nights and moments that don&apos;t feel fully real.
            </p>
            <p className="mt-5 italic text-brand-ink-soft md:text-lg">
              Sunsets that last a little longer…
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-3 md:mt-16 md:grid-cols-3 md:gap-6">
            {PRODUCT_PILLARS.map((pillar, idx) => (
              <Link
                key={pillar.label}
                href="/products"
                className={`group relative overflow-hidden rounded-[1.25rem] p-6 fluid-transition hover:-translate-y-1 md:rounded-[1.5rem] md:p-10 ${pillar.tint}`}
              >
                <div className="mb-10 flex items-start justify-between md:mb-16">
                  <p className="eyebrow text-brand-ink/50">0{idx + 1}</p>
                  <ArrowUpRight
                    size={18}
                    className="text-brand-ink/50 opacity-0 fluid-transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </div>
                <h3 className="display text-2xl text-brand-ink md:text-4xl">
                  {pillar.label}.
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* === 04 — EXPERIENCE / LIFESTYLE === */}
      <section className="relative mx-auto my-12 w-full max-w-[1440px] px-5 md:my-20 md:px-6 lg:my-32 lg:px-12">
        <Link
          href="/catalogo"
          className="group relative block overflow-hidden rounded-[1.5rem] md:rounded-[2rem]"
        >
          <div className="relative aspect-[4/5] sm:aspect-[5/3] lg:aspect-[21/9]">
            <Image
              src="/brand/holo-trama-1.jpg"
              alt="Iridescent holographic texture"
              fill
              sizes="(max-width: 768px) 100vw, 80vw"
              className="object-cover fluid-transition group-hover:scale-[1.02]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-brand-ink/30 via-brand-ink/10 to-brand-ink/50"
            />
          </div>

          <div className="absolute inset-0 flex flex-col justify-between gap-8 p-6 md:p-12 lg:p-16">
            <p className="eyebrow text-white/80">04 — a different lifestyle</p>

            <div className="flex flex-col gap-6 md:gap-8">
              <h2 className="display chromatic-title max-w-[20ch] text-[clamp(1.75rem,6vw,4.5rem)] text-white">
                More than sunglasses.
                <br />
                <span className="italic font-light">A vibe.</span>
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
                When you wear Allternativ, you&apos;re not completing a look.
                You&apos;re entering a different frequency.
              </p>
              <span className="inline-flex items-center gap-2 eyebrow text-white fluid-transition group-hover:gap-3">
                View the lookbook
                <ArrowUpRight size={16} />
              </span>
            </div>
          </div>
        </Link>

        <div className="mt-10 grid gap-6 md:mt-16 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
          <p className="eyebrow text-brand-muted">Built for</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {LIFESTYLE_MOMENTS.map((moment) => (
              <li
                key={moment}
                className="text-base text-brand-ink md:text-lg lg:text-xl"
              >
                {moment}
                <span aria-hidden="true" className="ml-6 text-brand-muted">
                  ·
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* === 05 — CLOSING === */}
      <section className="relative mx-auto w-full max-w-[1440px] px-5 pb-20 pt-12 md:px-6 md:pb-32 md:pt-20 lg:px-12 lg:pb-48 lg:pt-32">
        <div className="glass relative mx-auto max-w-4xl rounded-[1.5rem] p-8 text-center md:rounded-[2rem] md:p-16 lg:p-20">
          <p className="eyebrow text-brand-muted mb-6">05 — closing</p>
          <h2 className="display chromatic-title text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
            Not just eyewear —
            <br />
            <span className="italic font-light">a shift in frequency.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3 md:mt-12">
            <Link
              href="/products"
              className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
            >
              Shop now
              <ArrowUpRight
                size={16}
                className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/frequency"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-ink/20 px-6 py-3 eyebrow text-brand-ink fluid-transition hover:border-brand-ink hover:bg-white/50"
            >
              Enter the frequency
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
