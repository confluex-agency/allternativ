import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  mockProducts,
  tintToClass,
  formatMockPrice,
} from "@/lib/mock-data";
import { HeroGlassesLazy } from "@/components/storefront/hero-glasses-lazy";

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

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* === HERO === */}
      <section className="relative min-h-[calc(100dvh-4rem)] md:min-h-[92vh] overflow-hidden">
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
          className="pointer-events-none absolute -top-20 -left-20 size-[340px] md:size-[520px] holo-conic opacity-60"
        />

        {/* Auto-rotating 3D glasses with frequency glow — desktop only */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block lg:w-[42%]">
          <HeroGlassesLazy />
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
      </section>

      {/* === 01 — BRAND WORLD === */}
      <section className="relative mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-16">
          <div className="md:col-span-7">
            <p className="eyebrow text-brand-muted mb-5">01 — brand world</p>
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
          </div>

          <div className="relative md:col-span-5 aspect-[4/5] overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
            <Image
              src="/brand/liquid-iridescent.png"
              alt="Iridescent liquid texture"
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* === 02 — PRODUCT IDENTITY === */}
      <section className="bg-white/60 py-20 md:py-32 lg:py-48">
        <div className="mx-auto max-w-[1440px] px-5 md:px-6 lg:px-12">
          <div className="max-w-3xl">
            <p className="eyebrow text-brand-muted mb-5">02 — product identity</p>
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
              <article
                key={pillar.label}
                className={`relative overflow-hidden rounded-[1.25rem] p-6 md:rounded-[1.5rem] md:p-10 ${pillar.tint}`}
              >
                <p className="eyebrow text-brand-ink/50 mb-10 md:mb-16">
                  0{idx + 1}
                </p>
                <h3 className="display text-2xl text-brand-ink md:text-4xl">
                  {pillar.label}.
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* === 03 — THE COLLECTION === */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="mb-10 flex flex-col gap-4 md:mb-16 md:flex-row md:items-end md:justify-between md:gap-6">
          <div>
            <p className="eyebrow text-brand-muted mb-3 md:mb-4">
              03 — the collection
            </p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              Three pieces.
              <br />
              <span className="italic font-light">One frequency.</span>
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex eyebrow text-brand-ink-soft fluid-transition hover:text-brand-ink"
          >
            Explore collection →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {mockProducts.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group block"
            >
              <div
                className={`relative aspect-square overflow-hidden rounded-[1.25rem] md:rounded-[1.5rem] fluid-transition group-hover:-translate-y-1 ${tintToClass[product.tint]}`}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 fluid-transition"
                  style={{
                    background:
                      "radial-gradient(at 50% 50%, rgba(255,255,255,0.4), transparent 70%)",
                    mixBlendMode: "screen",
                  }}
                />
                <div className="absolute inset-0 grid place-items-center">
                  <span
                    aria-hidden="true"
                    className="eyebrow text-[10px] md:text-xs text-brand-ink/30"
                  >
                    placeholder
                  </span>
                </div>
                <span className="absolute left-4 top-4 eyebrow text-[10px] text-brand-ink/50 md:left-6 md:top-6">
                  {product.code}
                </span>
              </div>
              <div className="mt-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base text-brand-ink md:text-lg">
                    {product.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-brand-muted">
                    {product.tagline}
                  </p>
                </div>
                <p className="text-xs text-brand-ink md:text-sm whitespace-nowrap">
                  {formatMockPrice(product.priceCents)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* === 04 — EXPERIENCE / LIFESTYLE === */}
      <section className="relative mx-auto my-12 w-full max-w-[1440px] px-5 md:my-20 md:px-6 lg:my-32 lg:px-12">
        <div className="relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
          <div className="relative aspect-[4/5] sm:aspect-[5/3] lg:aspect-[21/9]">
            <Image
              src="/brand/holo-trama-1.jpg"
              alt="Iridescent holographic texture"
              fill
              sizes="(max-width: 768px) 100vw, 80vw"
              className="object-cover"
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
            </div>
          </div>
        </div>

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
