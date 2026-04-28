import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  mockCategories,
  mockProducts,
  tintToClass,
  formatMockPrice,
} from "@/lib/mock-data";

export default function HomePage() {
  const featured = mockProducts.slice(0, 4);

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

        <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] md:min-h-[92vh] max-w-[1440px] flex-col justify-between gap-12 px-5 pb-16 pt-14 md:pt-32 lg:px-12 lg:pt-44">
          <div className="max-w-[72rem]">
            <p className="eyebrow text-brand-ink-soft mb-5">
              SS&apos;26 — tornasol collection
            </p>
            <h1 className="display chromatic-title text-[clamp(3rem,13vw,8rem)] text-brand-ink">
              escape
              <br />
              the ordinary.
            </h1>
          </div>

          <div className="flex flex-col gap-8 md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-10">
            <p className="max-w-md text-sm leading-relaxed text-brand-ink-soft md:text-base">
              Lentes pensados para quienes ven el mundo distinto. Inspirados
              en música electrónica, sunsets y las texturas tornasol de una
              realidad alterada.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
              >
                Shop the drop
                <ArrowUpRight
                  size={16}
                  className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/about"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-ink/20 px-6 py-3 eyebrow text-brand-ink fluid-transition hover:border-brand-ink hover:bg-white/50"
              >
                Our story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* === CONCEPT === */}
      <section className="relative mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-16">
          <div className="md:col-span-7">
            <p className="eyebrow text-brand-muted mb-5">01 — manifesto</p>
            <h2 className="display text-[clamp(2rem,7vw,4.5rem)] text-brand-ink">
              Una marca para
              <br />
              <span className="italic font-light">realidades alteradas.</span>
            </h2>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-brand-ink-soft md:mt-10 md:text-lg">
              Allternativ nace de la intersección entre el techno, los
              sunsets y lo sensorial. Cada par de lentes es una puerta a
              otra frecuencia — envolvente, introspectiva, humana.
            </p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-ink-soft md:text-lg">
              No buscamos un accesorio. Buscamos el objeto que te acompaña
              cuando el día empieza a doblarse sobre sí mismo.
            </p>
          </div>

          <div className="relative md:col-span-5 aspect-[4/5] overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
            <Image
              src="/brand/liquid-iridescent.png"
              alt="Textura holográfica líquida"
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* === COLLECTIONS === */}
      <section className="mx-auto max-w-[1440px] px-5 pb-20 md:px-6 md:pb-32 lg:px-12">
        <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between md:gap-6">
          <div>
            <p className="eyebrow text-brand-muted mb-3 md:mb-4">02 — collections</p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              Cuatro cápsulas,
              <br />
              una misma frecuencia.
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex eyebrow text-brand-ink-soft fluid-transition hover:text-brand-ink"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {mockCategories.map((cat, idx) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.slug}`}
              className={`group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[1.25rem] p-4 md:rounded-[1.5rem] md:p-6 fluid-transition hover:-translate-y-1 ${tintToClass[cat.tint]}`}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 fluid-transition group-hover:opacity-100 mix-blend-screen"
                style={{
                  background:
                    "radial-gradient(at 70% 30%, rgba(255,255,255,0.8), transparent 60%)",
                }}
              />
              <p className="eyebrow text-brand-ink/60">0{idx + 1}</p>
              <div>
                <h3 className="display text-2xl md:text-3xl text-brand-ink">
                  {cat.name}
                </h3>
                <p className="mt-1 text-xs md:text-sm text-brand-ink-soft">
                  {cat.blurb}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* === FEATURED === */}
      <section className="bg-white/60 py-20 md:py-32 lg:py-48">
        <div className="mx-auto max-w-[1440px] px-5 md:px-6 lg:px-12">
          <div className="mb-10 flex items-end justify-between gap-4 md:mb-12 md:gap-6">
            <div>
              <p className="eyebrow text-brand-muted mb-3 md:mb-4">03 — featured</p>
              <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
                Nuevas entradas.
              </h2>
            </div>
            <Link
              href="/products"
              className="eyebrow text-brand-ink-soft fluid-transition hover:text-brand-ink whitespace-nowrap"
            >
              All →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
            {featured.map((product) => (
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
                </div>
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm md:text-base text-brand-ink">
                      {product.name}
                    </h3>
                    <p className="mt-1 truncate text-xs text-brand-muted">
                      {product.tagline}
                    </p>
                  </div>
                  <p className="text-xs md:text-sm text-brand-ink whitespace-nowrap">
                    {formatMockPrice(product.priceCents)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* === LIFESTYLE BANNER === */}
      <section className="relative mx-auto my-20 w-full max-w-[1440px] px-5 md:my-32 md:px-6 lg:my-48 lg:px-12">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] sm:aspect-[5/3] md:rounded-[2rem] lg:aspect-[21/9]">
          <Image
            src="/brand/holo-trama-1.png"
            alt="Trama holográfica tornasol"
            fill
            sizes="(max-width: 768px) 100vw, 80vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-brand-ink/20 via-brand-ink/5 to-brand-ink/40"
          />
          <div className="absolute inset-0 flex flex-col items-start justify-end gap-4 p-6 md:gap-6 md:p-12 lg:p-16">
            <p className="eyebrow text-white/80">04 — lifestyle</p>
            <h2 className="display chromatic-title max-w-[18ch] text-[clamp(1.75rem,6vw,4.5rem)] text-white">
              Cuando el sunset
              <br />
              dura un poco más.
            </h2>
            <Link
              href="/about"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-3 eyebrow text-brand-ink fluid-transition hover:bg-brand-rose"
            >
              Conocé la marca
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* === NEWSLETTER === */}
      <section className="relative mx-auto w-full max-w-[1440px] px-5 pb-20 md:px-6 md:pb-32 lg:px-12 lg:pb-48">
        <div className="glass relative mx-auto max-w-3xl rounded-[1.5rem] p-6 text-center md:rounded-[2rem] md:p-10 lg:p-16">
          <p className="eyebrow text-brand-muted mb-3 md:mb-4">Newsletter</p>
          <h2 className="display text-[clamp(1.5rem,4vw,2.5rem)] text-brand-ink">
            Suscribite y recibí el preview
            <br />
            antes que nadie.
          </h2>
          <form className="mx-auto mt-8 flex max-w-md flex-col gap-3 md:mt-10 sm:flex-row">
            <input
              type="email"
              required
              placeholder="tu@email.com"
              className="min-h-11 flex-1 rounded-full border border-brand-ink/15 bg-white/70 px-5 py-3 text-base text-brand-ink placeholder:text-brand-muted focus:border-brand-ink focus:outline-none fluid-transition"
              aria-label="Email"
            />
            <button
              type="submit"
              className="min-h-11 rounded-full bg-brand-ink px-7 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
            >
              Join
            </button>
          </form>
          <p className="mt-5 text-xs text-brand-muted">
            Solo lanzamos newsletter cuando hay algo real para contar.
          </p>
        </div>
      </section>
    </div>
  );
}
