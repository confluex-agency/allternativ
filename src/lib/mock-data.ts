// Static mock data used while the product catalogue is being photographed.
// Swap this module for real Prisma queries once the designer ships the assets.

export type MockProduct = {
  slug: string;
  name: string;
  code: string;
  tagline: string;
  priceCents: number;
  compareAtPriceCents?: number;
  tint: "rose" | "mint" | "sky" | "beige";
  type: "SUNGLASSES" | "OPTICAL" | "BLUE_LIGHT" | "READING";
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
