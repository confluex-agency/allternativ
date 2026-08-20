import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata = {
  title: "About",
  description:
    "Allternativ was created from a simple idea: what if style wasn't something you wear, but something you feel.",
};

const INSPIRATIONS = [
  {
    title: "Music culture",
    body: "Techno, ambient, dance — long frequencies that shape the curves and presence of every frame we make.",
    tint: "bg-brand-mint",
  },
  {
    title: "Emotional spaces",
    body: "Sunset hours, late drives, festival nights. The places where reality bends and a different mood takes over.",
    tint: "bg-brand-rose",
  },
  {
    title: "Visual distortion",
    body: "Iridescent textures, chromatic shifts, light refracting through colour. Objects that move between fashion and experience.",
    tint: "bg-brand-sky",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <section className="relative min-h-[60vh] overflow-hidden md:min-h-[70vh]">
        <Image
          src="/brand/holo-trama-2.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-80"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-beige/40 to-brand-beige"
        />
        <div className="relative mx-auto flex min-h-[60vh] md:min-h-[70vh] max-w-[1440px] flex-col justify-end px-5 py-14 md:px-6 md:py-24 lg:px-12">
          <p className="eyebrow text-brand-ink-soft mb-5">about</p>
          <h1 className="display chromatic-title text-[clamp(2.75rem,11vw,7rem)] text-brand-ink">
            Allternativ.
          </h1>
          <p className="mt-6 max-w-xl text-base italic text-brand-ink-soft md:text-lg">
            A frequency you can wear.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="grid gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-5">
            <p className="eyebrow text-brand-muted mb-5">manifesto</p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              A simple
              <br />
              <span className="italic font-light">idea.</span>
            </h2>
          </div>
          <div className="space-y-5 text-base leading-relaxed text-brand-ink-soft md:col-span-7 md:space-y-6 md:text-lg">
            <p>Allternativ was created from a simple idea:</p>
            <p className="display text-2xl text-brand-ink md:text-3xl">
              What if style wasn&apos;t just something you wear — but something
              you feel?
            </p>
            <p>
              Inspired by music culture, emotional spaces and visual distortion,
              we design objects that live between fashion and experience.
            </p>
            <p className="italic">We follow energy. We follow vibes.</p>
          </div>
        </div>
      </section>

      <section className="bg-white/60 py-20 md:py-32 lg:py-48">
        <div className="mx-auto max-w-[1440px] px-5 md:px-6 lg:px-12">
          <p className="eyebrow text-brand-muted mb-5">inspirations</p>
          <h2 className="display mb-10 text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink md:mb-16">
            Three threads.
          </h2>
          <div className="grid gap-4 md:grid-cols-3 md:gap-6">
            {INSPIRATIONS.map((entry, idx) => (
              <article
                key={entry.title}
                className={`relative overflow-hidden rounded-[1.25rem] p-6 md:rounded-[1.5rem] md:p-10 ${entry.tint}`}
              >
                <p className="eyebrow text-brand-ink/50 mb-10 md:mb-16">
                  0{idx + 1}
                </p>
                <h3 className="display text-2xl text-brand-ink md:text-3xl">
                  {entry.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-ink-soft md:mt-4">
                  {entry.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-16">
          <div className="relative md:col-span-6 aspect-[4/5] overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
            <Image
              src="/brand/product-prism.png"
              alt="Prism reference — iridescent finish"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="md:col-span-6">
            <p className="eyebrow text-brand-muted mb-5">closing</p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              Not just eyewear —
              <br />
              <span className="italic font-light">a shift in frequency.</span>
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-brand-ink-soft md:mt-8">
              Designed slowly. Worn freely. Built for the moments that don&apos;t
              feel fully real — and the ones you don&apos;t want to forget.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 md:mt-10">
              <Link
                href="/collections"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
              >
                Shop the collection
                <ArrowUpRight size={16} />
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
