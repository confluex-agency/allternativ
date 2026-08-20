import Link from "next/link";
import { LensReveal } from "@/components/storefront/lens-reveal";

export const metadata = {
  title: "Lens reveal — prototype",
};

// Throwaway page to feel Direction A in a real scroll context: a hero stub on
// top, the scroll-pinned lens reveal, then a collection stub below. Not linked.
export default function RevealTestPage() {
  return (
    <div>
      {/* Hero stub (stands in for the real hero) */}
      <section className="relative flex h-[92vh] flex-col justify-center overflow-hidden px-5 md:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "linear-gradient(120deg, var(--brand-sky), var(--brand-rose) 45%, var(--brand-mint) 80%)",
            filter: "blur(20px)",
          }}
        />
        <div className="relative">
          <p className="eyebrow text-brand-ink/60 mb-4">
            SS&apos;26 — Frequency collection
          </p>
          <h1 className="display text-[clamp(3rem,12vw,8rem)] text-brand-ink">
            escape
            <br />
            the ordinary.
          </h1>
          <p className="mt-8 eyebrow text-brand-ink/40">
            (hero de mentira — baja para ver el reveal ↓)
          </p>
        </div>
      </section>

      {/* Direction A */}
      <LensReveal />

      {/* Collection stub (the payoff after the reveal) */}
      <section className="mx-auto max-w-[1240px] px-5 py-24 text-center md:px-12 md:py-32">
        <p className="eyebrow text-brand-muted mb-4">02 — The collection</p>
        <h2 className="display text-[clamp(2rem,6vw,4rem)] text-brand-ink">
          Wear the whole spectrum.
        </h2>
        <Link
          href="/collections"
          className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-ink/20 px-6 py-3 eyebrow text-brand-ink fluid-transition hover:border-brand-ink"
        >
          Ver catálogo ↗
        </Link>
      </section>
    </div>
  );
}
