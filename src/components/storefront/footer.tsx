import Link from "next/link";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "All eyewear" },
      { href: "/products?type=SUNGLASSES", label: "Sunglasses" },
      { href: "/products?type=OPTICAL", label: "Optical" },
      { href: "/products?type=BLUE_LIGHT", label: "Blue Light" },
    ],
  },
  {
    title: "Brand",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "#", label: "Stockists" },
      { href: "#", label: "Journal" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "#", label: "Shipping" },
      { href: "#", label: "Returns" },
      { href: "#", label: "Care" },
      { href: "#", label: "FAQ" },
    ],
  },
  {
    title: "Follow",
    links: [
      { href: "#", label: "Instagram" },
      { href: "#", label: "TikTok" },
      { href: "#", label: "Spotify" },
      { href: "#", label: "Newsletter" },
    ],
  },
];

export function StorefrontFooter() {
  return (
    <footer className="relative overflow-hidden bg-brand-ink text-brand-beige mt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-32 holo-conic opacity-30"
      />

      <div className="relative overflow-hidden border-y border-white/10 py-5 md:py-6">
        <div className="flex animate-[marquee_40s_linear_infinite] whitespace-nowrap gap-12 md:gap-16">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="display text-4xl md:text-5xl lg:text-7xl text-brand-beige/80"
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
