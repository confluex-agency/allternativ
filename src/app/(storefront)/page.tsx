import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLiveProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/storefront/product-card";
import {
  HeroScenes,
  type HeroScene,
} from "@/components/storefront/hero-scenes";

// The chosen hero direction. Three frames from one rooftop shoot at golden
// hour: the prism, the light it throws, and the sky it is held against.
//
// ⚠️ These are AI campaign images and the eyewear in them is NOT a real
// Allternativ product, which is why the hero deliberately never names a model.
// They are placeholders for a real shoot in the same direction, and swapping
// them is a change of these three files and nothing else.
const HERO_SCENES: HeroScene[] = [
  {
    src: "/campaign/hero-01.webp",
    alt: "Model on a rooftop at golden hour holding a prism up to the low sun",
  },
  { src: "/campaign/hero-02.webp", alt: "" },
  { src: "/campaign/hero-03.webp", alt: "" },
];

const LIFESTYLE_MOMENTS = [
  "Summer nights",
  "Raves & festivals",
  "Sunset drives",
  "Late city walks",
  "Moments you don't want to forget",
];

// Section 03. Each pillar now shows the quality it names instead of asserting
// it over a flat colour: the slim metal temple for lightweight, the bare shield
// and its laser mark for minimal, the tortoise cat-eye throwing a spectrum for
// expressive.
//
// The brand colour survives as a veil over the photograph rather than being
// replaced by it, and the veil thins on hover so the frame comes forward. Both
// opacities are written out in full because Tailwind reads these strings
// literally; a template would not be picked up.
const PRODUCT_PILLARS = [
  {
    label: "Lightweight",
    veil: "bg-brand-mint/80 group-hover:bg-brand-mint/45",
    src: "/campaign/identity-lightweight.webp",
    alt: "Slim gold metal frame worn in low sun, the Allternativ wordmark on the temple",
  },
  {
    label: "Minimal",
    veil: "bg-brand-sky/75 group-hover:bg-brand-sky/40",
    src: "/campaign/identity-minimal.webp",
    alt: "Macro of a black shield lens carrying nothing but the etched Allternativ mark",
  },
  {
    label: "Expressive",
    veil: "bg-brand-rose/80 group-hover:bg-brand-rose/45",
    src: "/campaign/identity-expressive.webp",
    alt: "Tortoise cat-eye frame in sunlight, throwing a small spectrum onto the cheek",
  },
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
      {/* Golden hour: three frames from one rooftop shoot, cross-fading. The
          copy sits over open sky in every frame, which is why it stays legible
          with a warm scrim instead of the dark overlay a photo hero usually
          needs. Replaces the floating 3D head; that component still exists and
          is used on other branches. */}
      <section className="relative overflow-hidden min-h-[75svh] sm:min-h-[calc(100dvh-4rem)] md:min-h-[92vh]">
        <HeroScenes scenes={HERO_SCENES} />

        {/* Two scrims, both beige rather than black: a dark overlay would read
            as a different brand entirely. The first lifts the left side so the
            headline holds on any frame; the second lands the photo on the page
            colour so the collection below does not start with a hard edge. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-brand-beige/85 via-brand-beige/30 to-transparent sm:from-brand-beige/70 sm:via-brand-beige/10"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-brand-beige/25 via-transparent to-brand-beige"
        />

        <div className="relative z-10 mx-auto flex min-h-[75svh] sm:min-h-[calc(100dvh-4rem)] md:min-h-[92vh] max-w-[1440px] flex-col justify-between gap-10 px-5 pb-20 pt-10 md:px-6 md:pb-28 md:pt-32 lg:px-12 lg:pt-44">
          <div className="max-w-[44rem]">
            <p className="eyebrow text-brand-ink-soft mb-4 md:mb-5">
              SS&apos;26 — frequency collection
            </p>
            <h1 className="display chromatic-title text-[clamp(2.75rem,11vw,8rem)] leading-[0.95] text-brand-ink">
              escape
              <br />
              the ordinary.
            </h1>
            <p className="mt-5 text-lg italic text-brand-ink-soft md:mt-8 md:text-2xl">
              A frequency you can wear.
            </p>
          </div>

          <div className="flex flex-col gap-6 md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-10">
            <p className="max-w-md text-sm leading-relaxed text-brand-ink-soft md:text-base">
              Eyewear for those who live between music, light and emotion —
              where summer nights feel infinite and daily reality feels
              optional.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
              >
                Shop the collection
                <ArrowUpRight
                  size={16}
                  className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/frequency"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-brand-ink/25 bg-brand-beige/40 px-6 py-3 eyebrow text-brand-ink backdrop-blur-sm fluid-transition hover:border-brand-ink hover:bg-brand-beige/70"
              >
                Enter the frequency
              </Link>
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
            {/* The copy beside this says the brand is a shift in perception, and
                the frame is what does the shifting. An abstract iridescent
                texture stood here and illustrated the words with a mood; this
                shows the thing itself: low sun on a rooftop, and the spectrum
                the lens throws across a white shirt. Object position sits right
                so the crop keeps the model when the slot goes portrait. */}
            <Image
              src="/campaign/brand-world.webp"
              alt="Rooftop at golden hour, a spectrum thrown across a white shirt"
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              data-framing="brand-world"
              data-framing-label="02 — brand world"
              // 69% pulls the crop window right until the face carries the
              // frame. No breakpoint prefix: the slot is 4/5 at every width, so
              // the crop geometry is identical and one value serves both. Only
              // the horizontal matters here — a landscape photograph in a
              // portrait frame is cropped on the sides, never top to bottom.
              className="object-cover object-[69%_50%] fluid-transition group-hover:scale-[1.04]"
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
            <p className="eyebrow text-brand-muted mb-5">
              03 — product identity
            </p>
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
                /* Landscape on phones, editorial column on desktop: at 4/5 the
                   three stacked tiles ran past 1300px on a phone, which is a
                   lot of scrolling for three words. */
                className="group relative flex aspect-[3/2] flex-col justify-between overflow-hidden rounded-[1.25rem] p-6 fluid-transition hover:-translate-y-1 md:aspect-[4/5] md:rounded-[1.5rem] md:p-10"
              >
                <Image
                  src={pillar.src}
                  alt={pillar.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  data-framing={`identity-${pillar.label.toLowerCase()}`}
                  data-framing-label={`03 — ${pillar.label.toLowerCase()}`}
                  className="object-cover fluid-transition group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden="true"
                  className={`absolute inset-0 fluid-transition ${pillar.veil}`}
                />
                {/* The veil thins on hover, and the ink type has to survive that
                    without turning the tile into a dark card. A short scrim at
                    the foot carries the label; the number at the top sits over
                    the thickest part of the veil and needs nothing. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-brand-beige/80 to-transparent"
                />
                <div className="relative flex items-start justify-between">
                  <p className="eyebrow text-brand-ink/60">0{idx + 1}</p>
                  <ArrowUpRight
                    size={18}
                    className="text-brand-ink/60 opacity-0 fluid-transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </div>
                <h3 className="relative display text-2xl text-brand-ink md:text-4xl">
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
              src="/campaign/lifestyle-after-dark.webp"
              alt="A crowd dancing in a dark warehouse, one person in silver wraparound frames"
              fill
              sizes="(max-width: 768px) 100vw, 80vw"
              data-framing="lifestyle-after-dark"
              data-framing-label="04 — a different lifestyle"
              className="object-cover fluid-transition group-hover:scale-[1.02]"
            />
            {/* Lighter than the scrim the holographic texture needed: this frame
                is already night, and the old gradient buried it. Just enough to
                seat the white type. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-brand-ink/70 via-brand-ink/15 to-brand-ink/25"
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
      <section className="mx-auto w-full max-w-[1440px] px-5 pb-20 pt-12 md:px-6 md:pb-32 md:pt-20 lg:px-12 lg:pb-48 lg:pt-32">
        <div className="relative overflow-hidden rounded-[1.5rem] px-4 py-14 md:rounded-[2rem] md:px-10 md:py-24 lg:py-32">
          <Image
            src="/campaign/closing.webp"
            alt=""
            fill
            sizes="100vw"
            data-framing="closing"
            data-framing-label="05 — closing"
            // Centred on phones, where the band is tall enough to hold the head
            // on its own and Nicolas signed it off as is. On desktop the band
            // goes wide and short, the crop turns into a horizontal slice, and
            // at 50% that slice lands below the eyes: 15% lifts it back onto
            // the face. Only the vertical matters — the slice already uses the
            // full width, so the horizontal value here changes nothing.
            className="object-cover object-center md:object-[50%_15%]"
          />
          {/* The card is frosted glass, and frosting needs something behind it.
              Sitting on the page beige it read as a flat outline; over a
              photograph it finally does what it was built for. The veil is what
              keeps the ink type legible without turning this into a dark
              banner, so it cannot come down much further. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-brand-beige/65"
          />

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
        </div>
      </section>
    </div>
  );
}
