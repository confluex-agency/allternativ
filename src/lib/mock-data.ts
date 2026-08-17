// Catalogue data for the Frequency collection.
// Photos are the client's real 9-angle shoots (one folder per colourway).
// NOTE: model names (Orbital aside) are PLACEHOLDERS — swap for the real names
// when they arrive. Swap this module for Prisma queries once the DB is wired.

export type Colorway = {
  key: string;
  name: string;
  sku: string; // buyable unit — this is what the supplier ERP ships against
  swatch: string; // CSS colour for the selector dot
  gallery: string[]; // ordered image srcs; [0] is the hero
};

export type MockProduct = {
  slug: string;
  name: string;
  code: string;
  tagline: string;
  priceCents: number;
  compareAtPriceCents?: number;
  type: "SUNGLASSES" | "OPTICAL" | "BLUE_LIGHT" | "READING";
  description?: string;
  frame?: string;
  lens?: string;
  origin?: string;
  photo?: boolean; // true = real lifestyle/street photos (fill the card, no studio bg)
  colorways: Colorway[]; // always at least one
};

// Build a gallery array for a colourway folder: /catalog/<slug>/<slug>-1.webp …
// Everything is WebP since 2026-08-17: the folder held 106MB of PNG that
// travelled on every deploy, and the same images are 3MB as WebP with no
// visible loss. The `ext` parameter is gone because there is nothing else left.
const g = (folder: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `/catalog/${folder}/${folder}-${i + 1}.webp`);

export const mockProducts: MockProduct[] = [
  {
    slug: "orbital",
    name: "Orbital",
    code: "ORB-01",
    tagline: "Wraparound / city motion",
    priceCents: 18900,
    type: "SUNGLASSES",
    description:
      "The wraparound that started the Frequency collection. Sculpted single-piece shield, feather-light, with our signature iridescent filter bending light across the whole lens.",
    frame: "Injected matte nylon",
    lens: "Smoke — iridescent filter",
    origin: "Handcrafted · LATAM",
    colorways: [
      { key: "black", name: "Negro", sku: "ORB-01-BLK", swatch: "#1c1c1e", gallery: g("orbital-black", 8) },
      { key: "silver", name: "Plata", sku: "ORB-01-SLV", swatch: "#c7cace", gallery: g("orbital-silver", 9) },
    ],
  },
  {
    slug: "halo",
    name: "Halo",
    code: "HAL-02",
    tagline: "Round metal / golden hour",
    priceCents: 21900,
    type: "SUNGLASSES",
    description:
      "Slim round metal in warm gold, tortoise temple tips and a bottle-green mineral lens. Vintage geometry, modern frequency.",
    frame: "Gold-tone metal · acetate tips",
    lens: "Bottle green — mineral",
    origin: "Handcrafted · LATAM",
    colorways: [
      { key: "gold", name: "Oro", sku: "HAL-02-GLD", swatch: "#c6a765", gallery: g("halo", 9) },
    ],
  },
  {
    // TEST — real street/lifestyle shoot of the Halo, to try real photos in the
    // catalogue instead of the studio angles. Same frame as "halo".
    slug: "halo-2",
    name: "Halo 2.0",
    code: "HAL-02B",
    tagline: "Round metal / worn in the wild",
    priceCents: 21900,
    type: "SUNGLASSES",
    description:
      "The Halo, shot on the street. Same slim round gold metal and bottle-green lens, framed against concrete, denim and golden-hour light.",
    frame: "Gold-tone metal · acetate tips",
    lens: "Bottle green — mineral",
    origin: "Handcrafted · LATAM",
    photo: true,
    colorways: [
      { key: "gold", name: "Oro", sku: "HAL-02B-GLD", swatch: "#c6a765", gallery: g("halo-2", 8) },
    ],
  },
  {
    slug: "vortex",
    name: "Vortex",
    code: "VRT-03",
    tagline: "Shield / full send",
    priceCents: 17900,
    type: "SUNGLASSES",
    description:
      "A one-lens sport shield built for speed. Angular, aerodynamic, unapologetically loud in crimson.",
    frame: "Matte acetate",
    lens: "Single shield — smoke gradient",
    origin: "Handcrafted · LATAM",
    colorways: [
      { key: "red", name: "Rojo", sku: "VRT-03-RED", swatch: "#b23a2e", gallery: g("vortex", 8) },
    ],
  },
  {
    slug: "nocturne",
    name: "Nocturne",
    code: "NOC-04",
    tagline: "Cat-eye / after dark",
    priceCents: 16900,
    type: "SUNGLASSES",
    description:
      "A sharp glossy cat-eye in deep black acetate. Quiet during the day, unmistakable after dark.",
    frame: "Glossy Italian acetate",
    lens: "Smoke — iridescent filter",
    origin: "Handcrafted · LATAM",
    colorways: [
      { key: "black", name: "Negro", sku: "NOC-04-BLK", swatch: "#141416", gallery: g("nocturne", 9) },
    ],
  },
  {
    slug: "prisma",
    name: "Prisma",
    code: "PRS-05",
    tagline: "Translucent / spectral",
    priceCents: 19900,
    type: "SUNGLASSES",
    description:
      "Squared translucent acetate in olive glass, so light passes through the frame itself. The most literal take on the Frequency idea.",
    frame: "Translucent olive acetate",
    lens: "Green mirror — mineral",
    origin: "Handcrafted · LATAM",
    colorways: [
      { key: "olive", name: "Oliva", sku: "PRS-05-OLV", swatch: "#9a9a5c", gallery: g("prisma", 9) },
    ],
  },
];

// Convenience: the hero image for a product (first colourway, first angle).
export function heroImage(product: MockProduct): string {
  return product.colorways[0].gallery[0];
}

export function formatMockPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}
