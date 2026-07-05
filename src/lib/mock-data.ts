// Static mock data used while the product catalogue is being photographed.
// Swap this module for real Prisma queries once the designer ships the assets.

export type ProductAngle = { src: string; label: string };

export type MockProduct = {
  slug: string;
  name: string;
  code: string;
  tagline: string;
  priceCents: number;
  compareAtPriceCents?: number;
  tint: "rose" | "mint" | "sky" | "beige";
  type: "SUNGLASSES" | "OPTICAL" | "BLUE_LIGHT" | "READING";
  // Editorial gallery — real photographed angles. Empty until the shoot lands.
  gallery?: ProductAngle[];
  // Whether the interactive 3D model (glasses-web.glb) is available for this piece.
  has3D?: boolean;
  description?: string;
  frame?: string;
  lens?: string;
  origin?: string;
};

export type MockCategory = {
  slug: string;
  name: string;
  blurb: string;
  tint: "rose" | "mint" | "sky" | "beige";
};

export const mockCategories: MockCategory[] = [
  {
    slug: "sunglasses",
    name: "Sunglasses",
    blurb: "For infinite sunsets",
    tint: "rose",
  },
  {
    slug: "optical",
    name: "Optical",
    blurb: "Prescription with character",
    tint: "mint",
  },
  {
    slug: "blue-light",
    name: "Blue Light",
    blurb: "Screens, quietly",
    tint: "sky",
  },
  {
    slug: "reading",
    name: "Reading",
    blurb: "Reading in calm",
    tint: "beige",
  },
];

export const mockProducts: MockProduct[] = [
  {
    slug: "the-corinthian",
    name: "The Corinthian",
    code: "89310",
    tagline: "Forest green / festival nights",
    priceCents: 18900,
    tint: "mint",
    type: "SUNGLASSES",
    has3D: true,
    description:
      "The first of the Frequency collection. A forest-green acetate frame with our signature iridescent filter — light bends through the lens the way it bends through the whole collection.",
    frame: "Matte Italian acetate",
    lens: "Mineral — iridescent filter",
    origin: "Handcrafted · LATAM",
    gallery: [
      { src: "/catalog/tile-1.jpg", label: "Three-quarter" },
      { src: "/catalog/tile-9.jpg", label: "Front 3/4" },
      { src: "/catalog/tile-8.jpg", label: "Front" },
      { src: "/catalog/tile-6.jpg", label: "Profile" },
      { src: "/catalog/tile-5.jpg", label: "Macro" },
      { src: "/catalog/tile-2.jpg", label: "Detail" },
      { src: "/catalog/tile-4.jpg", label: "Back" },
      { src: "/catalog/tile-3.jpg", label: "Top" },
      { src: "/catalog/tile-7.jpg", label: "Angle" },
    ],
  },
  {
    slug: "orbital",
    name: "Orbital",
    code: "5312JT",
    tagline: "Cool grey / city motion",
    priceCents: 17500,
    tint: "sky",
    type: "SUNGLASSES",
  },
  {
    slug: "neon-shift",
    name: "Neon Shift",
    code: "862JT",
    tagline: "Crimson red / late hours",
    priceCents: 16900,
    tint: "rose",
    type: "SUNGLASSES",
  },
];

export const tintToClass: Record<MockProduct["tint"], string> = {
  rose: "bg-brand-rose ring-1 ring-brand-ink/5",
  mint: "bg-brand-mint ring-1 ring-brand-ink/5",
  sky: "bg-brand-sky ring-1 ring-brand-ink/5",
  beige: "bg-[#ede5db] ring-1 ring-brand-ink/10",
};

export function formatMockPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}
