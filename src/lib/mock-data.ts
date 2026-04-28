// Static mock data used while the product catalogue is being photographed.
// Swap this module for real Prisma queries once the designer ships the assets.

export type MockProduct = {
  slug: string;
  name: string;
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
    blurb: "Para sunsets infinitos",
    tint: "rose",
  },
  {
    slug: "optical",
    name: "Optical",
    blurb: "Prescripción con carácter",
    tint: "mint",
  },
  {
    slug: "blue-light",
    name: "Blue Light",
    blurb: "Pantallas sin ruido",
    tint: "sky",
  },
  {
    slug: "reading",
    name: "Reading",
    blurb: "Lectura en calma",
    tint: "beige",
  },
];

export const mockProducts: MockProduct[] = [
  {
    slug: "nova-rose",
    name: "Nova",
    tagline: "Rosa tornasol",
    priceCents: 18900,
    compareAtPriceCents: 22900,
    tint: "rose",
    type: "SUNGLASSES",
  },
  {
    slug: "halo-mint",
    name: "Halo",
    tagline: "Verde menta holográfico",
    priceCents: 16500,
    tint: "mint",
    type: "OPTICAL",
  },
  {
    slug: "aurora-sky",
    name: "Aurora",
    tagline: "Azul techno",
    priceCents: 14900,
    tint: "sky",
    type: "BLUE_LIGHT",
  },
  {
    slug: "solace-beige",
    name: "Solace",
    tagline: "Beige cotidiano",
    priceCents: 12900,
    tint: "beige",
    type: "READING",
  },
  {
    slug: "mirage-rose",
    name: "Mirage",
    tagline: "Rosa espejado",
    priceCents: 19900,
    tint: "rose",
    type: "SUNGLASSES",
  },
  {
    slug: "echo-mint",
    name: "Echo",
    tagline: "Verde lluvia",
    priceCents: 15900,
    tint: "mint",
    type: "OPTICAL",
  },
  {
    slug: "drift-sky",
    name: "Drift",
    tagline: "Azul cielo bajo",
    priceCents: 14500,
    tint: "sky",
    type: "BLUE_LIGHT",
  },
  {
    slug: "ember-beige",
    name: "Ember",
    tagline: "Beige cálido",
    priceCents: 13500,
    tint: "beige",
    type: "READING",
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
