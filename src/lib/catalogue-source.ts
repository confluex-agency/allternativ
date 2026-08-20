// The launch catalogue: Collection 01, exactly as the client confirmed it.
//
// ⚠️ THIS IS REAL COMMERCIAL DATA, not sample content. Model codes, colourway
// names and opening stock come from the supplier's commercial invoice
// (Yiwu Max Eyewear, YM20260716) and from the client's written answers of
// 2026-08-20. Six models, sixteen colourways, three hundred pairs.
//
// It is the seed's input, not the storefront's. The shop reads `catalog.ts`,
// which reads the database. Once the admin CRUD ships, the database becomes the
// only source of truth and this file stops being replayed over it.
//
// ── What must NOT be invented here ──────────────────────────────────────────
// The client was explicit: "no queremos que se infiera ni se invente ninguna
// especificación que no esté confirmada por el proveedor. Si alguna
// especificación no aparece confirmada, preferimos leave it unpublished."
//
// So there are no frame materials, no lens materials, no UV rating, no
// dimensions, no weight, no fit and no country of origin in this file. The
// previous version carried all of them, invented, including "Handcrafted ·
// LATAM" on goods manufactured in China. A null field renders as nothing; a
// wrong field renders as a claim.

/** What a photo shows. Mirrors `ImageType` and the client's file-name prefixes. */
export type SourceImageType =
  | "PRODUCT"
  | "MODEL"
  | "DETAIL"
  | "CASE"
  | "LIFESTYLE"
  | "PACKAGING";

export type SourceImage = { url: string; type: SourceImageType };

export type SourceColorway = {
  /** Stable key, unique within the product. Also the selector's identity. */
  key: string;
  /**
   * Shown in the selector. These are the SUPPLIER's colour names, copied
   * verbatim. The client flagged that some of them ("Black Black") want an
   * editorial pass before launch, but inventing prettier names now is exactly
   * the mistake this file exists to stop. Rename when they send the list.
   */
  name: string;
  /** Ours. Stable, we control it, it is what the shop and the orders carry. */
  sku: string;
  /**
   * Daniel's code for this colourway, which is what his pickers read.
   * ⚠️ NULL EVERYWHERE ON PURPOSE: he has not sent them yet. Until he does, an
   * order reaching the ERP identifies the pair by model code plus colour name,
   * which a human has to interpret. Question 1 of the supplier document.
   */
  supplierSku: string | null;
  /** CSS colour for the selector dot. A UI affordance, not a product claim. */
  swatch: string;
  /** Opening stock from the supplier invoice. Sums to 50 per model. */
  stock: number;
};

export type SourceProduct = {
  slug: string;
  name: string;
  /** The supplier's model code, printed on the invoice. */
  code: string;
  /**
   * The opening line of the client's own "THE FEELING" copy, reused as the
   * short line under the name. Their words, not ours.
   */
  tagline: string;
  /** "THE FEELING", section 09. Client-written, kept apart from any spec. */
  feeling: string;
  priceCents: number;
  type: "SUNGLASSES" | "OPTICAL" | "BLUE_LIGHT" | "READING";
  /**
   * Whether the model may appear in the shop. DRAFT means the row exists with
   * its real codes and stock, but no page and no card, so the launch inventory
   * is recorded without publishing a product nobody can see.
   */
  status: "LIVE" | "DRAFT";
  /**
   * Stand-in imagery, shared across the colourways rather than attached to any
   * one of them. See PLACEHOLDER_IMAGE_PREFIX below.
   */
  placeholderImages: SourceImage[];
  colorways: SourceColorway[];
};

/**
 * ⚠️ EVERY IMAGE IN THIS FILE IS A PLACEHOLDER. None of them is a photograph of
 * an Allternativ product; there is no real product photography yet, for any of
 * the six models. The client is preparing it and will deliver it in the agreed
 * folder structure (`product-01`, `model-01`, `detail-01`, ...).
 *
 * They are attached to the PRODUCT and not to a colourway, deliberately: a
 * photo hung on "Black / Blue" is a claim that this is what Black / Blue looks
 * like. Hung on the product, it is set dressing.
 *
 * Which folder went to which model is ARBITRARY, chosen so the staging site
 * looks coherent. It carries no information.
 *
 * They are all under `/catalog/`, and the real photography will not be, so
 * purging them is one query:
 *
 *   DELETE FROM product_images WHERE url LIKE '/catalog/%';
 */
export const PLACEHOLDER_IMAGE_PREFIX = "/catalog/";

/** `/catalog/<folder>/<folder>-1.webp` … `-<count>.webp` */
const shots = (
  folder: string,
  count: number,
  type: SourceImageType = "PRODUCT",
): SourceImage[] =>
  Array.from({ length: count }, (_, i) => ({
    url: `${PLACEHOLDER_IMAGE_PREFIX}${folder}/${folder}-${i + 1}.webp`,
    type,
  }));

/** The eight lifestyle frames that sit loose inside `/catalog/halo/`. */
const HALO_LIFESTYLE: SourceImage[] = [
  "WhatsApp Image 2026-07-15 at 14.44.13.webp",
  "WhatsApp Image 2026-07-15 at 14.44.13 (1).webp",
  "WhatsApp Image 2026-07-15 at 14.44.13 (2).webp",
  "WhatsApp Image 2026-07-15 at 14.44.13 (3).webp",
  "WhatsApp Image 2026-07-15 at 14.44.13 (4).webp",
  "WhatsApp Image 2026-07-15 at 14.44.13 (5).webp",
  "WhatsApp Image 2026-07-15 at 14.44.13 (6).webp",
  "WhatsApp Image 2026-07-15 at 14.44.13 (7).webp",
].map((file) => ({
  url: `${PLACEHOLDER_IMAGE_PREFIX}halo/${file}`,
  type: "MODEL" as const,
}));

/**
 * €39 across every model and every colourway, in every market's own currency.
 * The client is explicit that there is no premium colourway and no price
 * difference between models, and that the regional prices are FIXED figures,
 * not a daily conversion of this one. Those live with the currency logic; this
 * is the base.
 */
const PRICE_CENTS = 3900;

export const catalogueProducts: SourceProduct[] = [
  {
    slug: "the-corinthian",
    name: "The Corinthian",
    code: "89310",
    tagline: "Structured, timeless, slightly untouchable.",
    feeling:
      "Structured, timeless, slightly untouchable. The Corinthian brings a sharper frequency to everyday movement — from slow afternoons to nights that don't need a plan. Made for those who don't follow the room, but somehow change it.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    placeholderImages: shots("prisma", 9),
    colorways: [
      { key: "olive-green", name: "Olive Green", sku: "89310-OLV", supplierSku: null, swatch: "#7d7a45", stock: 17 },
      { key: "black-black", name: "Black / Black", sku: "89310-BLK", supplierSku: null, swatch: "#16171a", stock: 17 },
      { key: "black-double-grey", name: "Black / Double Grey", sku: "89310-BDG", supplierSku: null, swatch: "#3f4247", stock: 16 },
    ],
  },
  {
    slug: "orbital",
    name: "Orbital",
    // ⚠️ 5119JT, NOT 5312JT. We carried the wrong code from May until the
    // client corrected it in writing on 2026-08-20.
    code: "5119JT",
    tagline: "Somewhere between here and somewhere else.",
    feeling:
      "Somewhere between here and somewhere else. Orbital is built for movement — changing light, changing places, changing frequencies. A frame for the moments when the ordinary starts to feel a little too familiar.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    placeholderImages: [
      ...shots("orbital-silver", 9),
      ...shots("orbital-black", 8),
    ],
    colorways: [
      { key: "mercury-black", name: "Mercury Black", sku: "5119JT-C03", supplierSku: null, swatch: "#b9bdc2", stock: 17 },
      { key: "sand-black", name: "Sand Black", sku: "5119JT-C09", supplierSku: null, swatch: "#b9a68a", stock: 17 },
      { key: "black-black", name: "Black Black", sku: "5119JT-C07", supplierSku: null, swatch: "#16171a", stock: 16 },
    ],
  },
  {
    slug: "neon-shift",
    name: "Neon Shift",
    code: "862JT",
    tagline: "Day fades. The frequency changes.",
    feeling:
      "Day fades. The frequency changes. Neon Shift lives in the transition — from golden hour to after dark, from familiar streets to somewhere unexpected. Designed for the hours when everything starts to feel different.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    placeholderImages: shots("vortex", 8),
    colorways: [
      { key: "red-black", name: "Red / Black", sku: "862JT-RED", supplierSku: null, swatch: "#b4322b", stock: 17 },
      { key: "black-black", name: "Black / Black", sku: "862JT-BLK", supplierSku: null, swatch: "#16171a", stock: 17 },
      { key: "black-blue", name: "Black / Blue", sku: "862JT-BLU", supplierSku: null, swatch: "#2a3f6b", stock: 16 },
    ],
  },
  {
    slug: "sync",
    name: "SYNC",
    code: "826JT",
    tagline: "Right place. Right people. Right frequency.",
    feeling:
      "Right place. Right people. Right frequency. SYNC is about those rare moments when everything aligns without trying. Clean, instinctive and made to move with you wherever the day turns into night.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    placeholderImages: [...shots("halo", 9), ...HALO_LIFESTYLE],
    colorways: [
      { key: "gold-black", name: "Gold / Black", sku: "826JT-GLD", supplierSku: null, swatch: "#c6a765", stock: 17 },
      { key: "silver-black", name: "Silver Black", sku: "826JT-SLV", supplierSku: null, swatch: "#c7cace", stock: 17 },
      { key: "black-black", name: "Black Black", sku: "826JT-BLK", supplierSku: null, swatch: "#16171a", stock: 16 },
    ],
  },
  {
    slug: "amplify",
    name: "Amplify",
    code: "2037JT",
    tagline: "Turn everything up.",
    feeling:
      "Turn everything up. Amplify was made for louder moments — bigger energy, longer nights and the kind of memories that never happen according to plan. Wear the frequency. Make it yours.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    placeholderImages: shots("nocturne", 9),
    colorways: [
      { key: "black-black", name: "Black / Black", sku: "2037JT-C01", supplierSku: null, swatch: "#16171a", stock: 25 },
      { key: "hawksbill-brown", name: "Hawksbill / Brown", sku: "2037JT-C05", supplierSku: null, swatch: "#7b4a26", stock: 25 },
    ],
  },
  {
    // DRAFT: the placeholder folders ran out before Prism did, and the only one
    // left is the same gold frame already standing in for SYNC. Rather than show
    // two models with identical imagery, this one stays unpublished. Its codes,
    // colourways and fifty units are recorded all the same, so the launch
    // inventory is complete and flipping it to LIVE is one field.
    slug: "prism",
    name: "Prism",
    code: "3980",
    tagline: "Same light. Different perspective.",
    feeling:
      "Same light. Different perspective. Prism is a reminder that reality changes depending on how you choose to see it. Designed for sunlight, reflections and everything outside the ordinary.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "DRAFT",
    placeholderImages: [],
    colorways: [
      { key: "black-black", name: "Black / Black", sku: "3980-C1", supplierSku: null, swatch: "#16171a", stock: 25 },
      { key: "demi-black", name: "Demi / Black", sku: "3980-C6", supplierSku: null, swatch: "#6b4423", stock: 25 },
    ],
  },
];

/**
 * Slugs the seed must retire. These were placeholder models invented while the
 * client had not named theirs; five of the six do not exist. They are set to
 * DISCONTINUED rather than deleted, because an order may already reference one
 * and an order must never lose what it was for.
 */
export const RETIRED_SLUGS = [
  "halo",
  "halo-2",
  "vortex",
  "nocturne",
  "prisma",
] as const;

/** Opening case stock, from the same supplier invoice. 150 of each. */
export const CASE_OPENING_STOCK: Record<"BLACK" | "WHITE", number> = {
  BLACK: 150,
  WHITE: 150,
};
