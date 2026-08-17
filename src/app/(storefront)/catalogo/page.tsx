import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// Editorial lookbook for the collection — the "grid they sent, made brand".
// Built with the real 9-angle photos (sliced from the client's reference grid).
// Placeholder-resolution (~400px) for now; production swaps in full-res shots.

type Tile = { src: string; label: string; wide?: boolean };

// Arranged for editorial rhythm: two wide "feature" frames (profile, macro)
// offset against each other, a brand-voice block breaking the grid.
const ROW_1: Tile[] = [
  { src: "/catalog/tile-1.webp", label: "Three-quarter" },
  { src: "/catalog/tile-8.webp", label: "Front" },
  { src: "/catalog/tile-9.webp", label: "Front 3/4" },
];
const ROW_2: Tile[] = [
  { src: "/catalog/tile-6.webp", label: "Profile", wide: true },
  { src: "/catalog/tile-2.webp", label: "Detail" },
];
const ROW_3: Tile[] = [
  { src: "/catalog/tile-5.webp", label: "Macro", wide: true },
];
const ROW_4: Tile[] = [
  { src: "/catalog/tile-4.webp", label: "Back" },
  { src: "/catalog/tile-3.webp", label: "Top" },
  { src: "/catalog/tile-7.webp", label: "Angle" },
];

function Frame({ tile }: { tile: Tile }) {
  return (
    <figure
      className={`group relative overflow-hidden rounded-[1rem] bg-white/60 fluid-transition hover:-translate-y-1 md:rounded-[1.5rem] ${
        tile.wide
          ? "aspect-[16/9] md:col-span-2"
          : "aspect-[16/10]"
      }`}
    >
      <Image
        src={tile.src}
        alt={`The Corinthian — ${tile.label}`}
        fill
        sizes="(max-width: 768px) 50vw, 33vw"
        className="object-cover fluid-transition group-hover:scale-[1.03]"
      />
      <figcaption className="absolute left-3 bottom-2 eyebrow text-[9px] text-brand-ink/40 md:left-4 md:bottom-3">
        {tile.label}
      </figcaption>
    </figure>
  );
}

export default function LookbookPage() {
  return (
    <div className="flex flex-col">
      {/* Intro — overflow-x-clip (not hidden) so the glow fades softly downward
          instead of being cut by a hard section edge, while still preventing any
          horizontal scroll from the off-canvas bloom. */}
      <section className="relative overflow-x-clip">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-56 -right-48 size-[860px] opacity-55"
          style={{
            background:
              "conic-gradient(from 210deg at 55% 45%, var(--brand-rose), var(--brand-mint), var(--brand-sky), var(--brand-rose))",
            filter: "blur(96px) saturate(1.05)",
            WebkitMaskImage:
              "radial-gradient(closest-side, #000 30%, transparent 80%)",
            maskImage:
              "radial-gradient(closest-side, #000 30%, transparent 80%)",
            borderRadius: "9999px",
          }}
        />
        <div className="relative mx-auto max-w-[1240px] px-5 pt-16 pb-8 md:px-6 md:pt-24 md:pb-12 lg:px-10">
          <p className="eyebrow text-brand-ink-soft mb-4">
            Frequency collection — lookbook
          </p>
          <h1 className="display chromatic-title text-[clamp(2.4rem,9vw,5.5rem)] text-brand-ink">
            Every angle.
          </h1>
          <p className="mt-5 max-w-xl text-brand-ink-soft md:mt-7 md:text-lg">
            The Corinthian, refracted. Nine views, one frequency — light bending
            through the lens the way it bends through the collection.
          </p>
        </div>
      </section>

      {/* Editorial mosaic */}
      <section className="mx-auto w-full max-w-[1240px] px-5 pb-10 md:px-6 md:pb-16 lg:px-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 [grid-auto-flow:dense]">
          {ROW_1.map((t) => (
            <Frame key={t.src} tile={t} />
          ))}

          {ROW_2.map((t) => (
            <Frame key={t.src} tile={t} />
          ))}

          {/* Brand-voice break */}
          <div className="col-span-2 flex flex-col justify-center rounded-[1rem] bg-brand-ink px-6 py-8 md:col-span-1 md:rounded-[1.5rem] md:px-8">
            <p className="display text-2xl leading-tight text-brand-beige md:text-3xl">
              Not just eyewear.
            </p>
            <p className="mt-1 text-lg italic text-brand-beige/70 md:text-xl">
              A shift in frequency.
            </p>
          </div>

          {ROW_3.map((t) => (
            <Frame key={t.src} tile={t} />
          ))}

          {ROW_4.map((t) => (
            <Frame key={t.src} tile={t} />
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto w-full max-w-[1240px] px-5 pb-20 md:px-6 md:pb-28 lg:px-10">
        <div className="glass flex flex-col items-start gap-6 rounded-[1.5rem] p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="display text-[clamp(1.5rem,3.5vw,2.4rem)] text-brand-ink">
              Wear the whole spectrum.
            </h2>
            <p className="mt-3 max-w-md text-brand-ink-soft">
              The Corinthian, in black — the first of the frequency collection.
            </p>
          </div>
          <Link
            href="/products"
            className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90"
          >
            Shop the collection
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
