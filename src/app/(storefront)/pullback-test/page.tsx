import Link from "next/link";
import { notFound } from "next/navigation";
import { PullbackStage } from "@/components/storefront/pullback-stage";
import { StudioStrip } from "@/components/storefront/studio-strip";
import { mockProducts } from "@/lib/mock-data";

export const metadata = {
  title: "Pull-back — prototype",
};

// Prototype of the post-hero sequence: Pull-Back (hero and product on one
// pinned stage) → Studio Strip (the shoot's angles, snapped) → collection stub.
// Not linked from the nav. The stage stands in for the real hero, so the mobile
// layout (rotated subtitle, framed head) isn't reproduced here — judge the
// motion and the sequence, not the hero's composition.
export default function PullbackTestPage() {
  const orbital = mockProducts.find((p) => p.slug === "orbital");
  if (!orbital) notFound();

  return (
    <div>
      <PullbackStage />
      <StudioStrip product={orbital} />

      {/* Collection stub — the payoff after the strip */}
      <section className="mx-auto max-w-[1240px] px-5 py-24 text-center md:px-12 md:py-32">
        <p className="eyebrow text-brand-muted mb-4">03 — the collection</p>
        <h2 className="display text-[clamp(2rem,6vw,4rem)] text-brand-ink">
          Find your frequency.
        </h2>
        <Link
          href="/products"
          className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-ink/20 px-6 py-3 eyebrow text-brand-ink fluid-transition hover:border-brand-ink"
        >
          Ver catálogo ↗
        </Link>
      </section>
    </div>
  );
}
