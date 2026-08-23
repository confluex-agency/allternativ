import Link from "next/link";
import { catalogueProducts } from "@/lib/catalogue-source";

const COLUMNS = [
  {
    title: "Shop",
    // Built from the catalogue so the column can't outlive its pieces. The old
    // per-type links (Optical, Blue Light) pointed at empty collections.
    links: [
      { href: "/collections", label: "Collections" },
      // LIVE only: a model still in draft has no page, so linking to it from
      // every footer on the site is a 404 in the most visible place there is.
      ...catalogueProducts
        .filter((p) => p.status === "LIVE")
        .map((p) => ({
          href: `/products/${p.slug}`,
          label: p.name,
        })),
    ],
  },
  {
    title: "Brand",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      // Stockists and Journal pointed at "#". Removed rather than left
      // hanging: a link that goes nowhere costs more trust than a shorter
      // column, and this is the footer, where somebody looks precisely because
      // they could not find something. They return when a page exists.
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/shipping", label: "Shipping" },
      { href: "/returns", label: "Returns" },
      { href: "/contact", label: "Contact us" },
      // Care and FAQ: same reason. No content written for either yet.
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
  // The "Follow" column held Instagram, TikTok, Spotify and Newsletter, all
  // pointing at "#". We do not have the accounts. A social icon that does
  // nothing reads as a brand that abandoned its accounts, which is worse than a
  // brand that has not opened them. Send the handles and the column returns;
  // the newsletter is question D4 of the build plan.
];

export function StorefrontFooter() {
  return (
    <footer className="relative overflow-hidden bg-brand-ink text-brand-beige mt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-32 holo-conic opacity-30"
      />

      <div className="relative overflow-hidden border-y border-white/10 py-5 md:py-6">
        <div className="flex w-max animate-[marquee_18s_linear_infinite] whitespace-nowrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="display pr-10 md:pr-12 text-xl md:text-2xl lg:text-3xl text-brand-beige/80"
            >
              escape the ordinary —
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 py-14 md:px-6 md:py-20 lg:px-12">
        <div className="grid grid-cols-2 gap-10 md:gap-12 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="col-span-2 max-w-sm md:col-span-1">
            <p className="eyebrow text-brand-beige/70 mb-4">Allternativ</p>
            <p className="text-sm leading-relaxed text-brand-beige/80">
              Eyewear designed for those who live between music, light and
              emotion. Inspired by electronic culture, sunsets and the
              iridescent textures of a sky in motion.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="eyebrow text-brand-beige/60 mb-5">{col.title}</h3>
              <ul className="space-y-3 text-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="fluid-transition text-brand-beige/80 hover:text-brand-beige"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-brand-beige/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Allternativ. All rights reserved.</p>
          <p>
            Developed by{" "}
            <Link
              href="https://confluex.dev"
              className="fluid-transition hover:text-brand-beige underline underline-offset-4 decoration-brand-rose/60"
            >
              Confluex →
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </footer>
  );
}
