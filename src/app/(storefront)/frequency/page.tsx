import Link from "next/link";
import { ArrowUpRight, Headphones, QrCode, Sparkles } from "lucide-react";

// TODO Phase 3 — replace this stub with the immersive 3D experience:
//   • Three.js / R3F scene: dark room geometry, neon accents
//   • Positional audio (DJ set) + AudioListener attached to camera
//   • Post-processing: bloom + chromatic aberration + occasional glitch flash
//   • Camera moves with device orientation / pointer
//   • Optional: glasses model floating in the scene to "try on" the vibe
//   • Audio source: DJ mp3 file or SoundCloud Widget API

export const metadata = {
  title: "Enter the Frequency",
  description:
    "Scan to unlock the Allternativ sound experience — a curated selection of music, DJ sets, and atmospheric sound.",
};

export default function FrequencyPage() {
  return (
    <div className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden bg-brand-ink text-brand-beige md:min-h-[100dvh]">
      {/* Background layers */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 holo-conic opacity-40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-ink/0 via-brand-ink/40 to-brand-ink"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-brand-rose/30 blur-[120px] md:size-[800px]"
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1440px] flex-col justify-between gap-16 px-5 pb-16 pt-20 md:min-h-[100dvh] md:gap-24 md:px-6 md:pt-32 lg:px-12 lg:pt-40">
        {/* Hero */}
        <header className="max-w-[60rem]">
          <p className="eyebrow mb-5 text-brand-beige/70">
            Allternativ — sound experience
          </p>
          <h1 className="display chromatic-title text-[clamp(2.75rem,12vw,8rem)] text-brand-beige">
            Enter the
            <br />
            <span className="italic font-light">Frequency.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-brand-beige/80 md:mt-8 md:text-lg">
            Scan to unlock the Allternativ sound experience. A curated
            selection of music, DJ sets and atmospheric sound designed to
            accompany your world.
          </p>
        </header>

        {/* Experience grid */}
        <section className="grid gap-4 md:grid-cols-3 md:gap-6">
          <article className="glass-dark relative overflow-hidden rounded-[1.25rem] border border-white/10 p-6 md:rounded-[1.5rem] md:p-8">
            <Headphones
              size={22}
              strokeWidth={1.5}
              className="text-brand-rose"
              aria-hidden="true"
            />
            <h2 className="display mt-8 text-xl text-brand-beige md:mt-10 md:text-2xl">
              DJ sets.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-beige/70 md:text-base">
              Hand-picked mixes from the artists shaping the Allternativ
              frequency.
            </p>
          </article>

          <article className="glass-dark relative overflow-hidden rounded-[1.25rem] border border-white/10 p-6 md:rounded-[1.5rem] md:p-8">
            <Sparkles
              size={22}
              strokeWidth={1.5}
              className="text-brand-sky"
              aria-hidden="true"
            />
            <h2 className="display mt-8 text-xl text-brand-beige md:mt-10 md:text-2xl">
              Atmospheric sound.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-beige/70 md:text-base">
              Ambient layers and textures for sunset hours and late city
              walks.
            </p>
          </article>

          <article className="glass-dark relative overflow-hidden rounded-[1.25rem] border border-white/10 p-6 md:rounded-[1.5rem] md:p-8">
            <QrCode
              size={22}
              strokeWidth={1.5}
              className="text-brand-mint"
              aria-hidden="true"
            />
            <h2 className="display mt-8 text-xl text-brand-beige md:mt-10 md:text-2xl">
              From the box.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-beige/70 md:text-base">
              Every pair arrives with a QR — a private door into the
              Allternativ sound world.
            </p>
          </article>
        </section>

        {/* 3D experience placeholder */}
        <section className="relative overflow-hidden rounded-[1.5rem] border border-white/10 md:rounded-[2rem]">
          <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
            <div
              aria-hidden="true"
              className="absolute inset-0 holo-conic opacity-50"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-brand-ink/40 via-brand-ink/20 to-brand-ink/70"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center md:gap-6 md:p-12">
              <p className="eyebrow text-brand-beige/70">
                immersive room — coming soon
              </p>
              <h2 className="display chromatic-title max-w-[20ch] text-[clamp(1.5rem,5vw,3rem)] text-brand-beige">
                A 3D space with sound.
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-brand-beige/70 md:text-base">
                Walk into a room. Hear the set. See the light shift. Wear
                Allternativ from inside the frequency.
              </p>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="flex flex-col gap-6 border-t border-white/10 pt-10 md:flex-row md:items-center md:justify-between md:pt-12">
          <p className="max-w-md text-sm italic text-brand-beige/60">
            Not just eyewear — a shift in frequency.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/collections"
              className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-beige px-6 py-3 eyebrow text-brand-ink fluid-transition hover:bg-white"
            >
              Shop the collection
              <ArrowUpRight
                size={16}
                className="fluid-transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/about"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-6 py-3 eyebrow text-brand-beige fluid-transition hover:border-white/60 hover:bg-white/5"
            >
              About Allternativ
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
