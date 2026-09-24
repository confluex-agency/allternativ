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
// The previous version carried a frame material, a lens material, a lens type
// and "Handcrafted · LATAM" on goods manufactured in China, all of it invented.
// A null field renders as nothing; a wrong field renders as a claim.
//
// From 2026-09-08 the specs below are no longer empty, and the rule did not
// change — the evidence arrived. Every value is transcribed from one of Max's
// six "Product information" sheets or from his written answer of that day, and
// `SourceSpecs` says which. What he has still not told us stays null: the fit,
// the country of origin and — the one that blocks a EU launch — the lens
// filter category.

/** What a photo shows. Mirrors `ImageType` and the client's file-name prefixes. */
export type SourceImageType =
  "PRODUCT" | "MODEL" | "DETAIL" | "CASE" | "LIFESTYLE" | "PACKAGING";

export type SourceImage = {
  url: string;
  type: SourceImageType;
  /**
   * The colourway the photo shows, by `SourceColorway.key`, or null when the
   * frame's colour cannot be read in it (a figure across a rooftop, a pair
   * held in a hand). See the note above `catalogueProducts`.
   */
  colorway: string | null;
};

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
  /**
   * Ours. Stable, we control it, it is what the shop and the orders carry.
   *
   * Format `MODEL_COLOUR`, which Daniel asked for on 2026-08-21: "SKUs should
   * be created on your side... 'Model Name_Sunglass Colour_Case Colour'". The
   * case colour is missing here on purpose - it is `caseColor` below, and the
   * third segment is appended per line item, by `fulfilmentSku`.
   *
   * ⚠️ Written out literally rather than derived from `name`, so that the
   * editorial pass the client still owes on names like "Black Black" cannot
   * silently rewrite a code his warehouse has already mapped.
   *
   * The supplier's own colourway codes (C03, C09, C01, C1...) are carried
   * inside the colour segment wherever the invoice had one. The model code
   * (89310, 5119JT...) is not: it travels beside the SKU, in the line item's
   * meta, where the packer can cross-check it against the invoice.
   */
  sku: string;
  /**
   * Daniel's own code for this colourway.
   *
   * ⚠️ NULL EVERYWHERE, AND NOW PERMANENTLY SO. Question 1 of the supplier
   * document asked him for these codes; on 2026-08-21 he answered that there
   * are none and that we should define the SKU ourselves. The column stays
   * because a second supplier, or Daniel changing his mind, would need it, and
   * because null here is the honest record: we do not have his code, and
   * copying ours into it would look like we did.
   */
  supplierSku: string | null;
  /** CSS colour for the selector dot. A UI affordance, not a product claim. */
  swatch: string;
  /**
   * The case this colourway is packed in at the factory. Not a choice the
   * shopper makes: Daniel's inventory of 2026-09-22 holds every colourway in
   * exactly one case colour, with no spare cases to swap.
   */
  caseColor: "BLACK" | "WHITE";
  /**
   * Opening stock, from Daniel's inventory sheet of 2026-09-22
   * (`skus-allternativ_Manuel.xlsx`), which the client confirmed as official.
   * It is one or two under the invoice on each colourway because samples went
   * to the founders. Written on create only; see the seed.
   */
  stock: number;
};

/**
 * What every unit carries on top of the frame itself, in US cents.
 *
 * From the same invoice: a pouch and cleaning cloth at 0.60, a leather case at
 * 0.95, a hard box at 1.20, and 0.30 of logo work. Every pair ships with all
 * four, so it is one constant rather than four columns.
 */
export const PACKAGING_COST_USD_CENTS = 60 + 95 + 120 + 30;

/**
 * The published specification of one frame.
 *
 * ⚠️ EVERY FIELD HERE IS TRANSCRIBED FROM A SUPPLIER DOCUMENT. Nothing is
 * derived, converted or filled in by resemblance to another model.
 *
 * Two sources, both dated and both kept:
 *
 * 1. **The six "Product information" sheets** Max sent on 2026-09-05
 *    (`para nico/archivos varios/MAX`). They are page images, not text, and
 *    they carry frame material, lens material, weight and the five
 *    measurements. Transcribed on 2026-09-08.
 * 2. **Max's written answer of 2026-09-08**, closing the question the sheets
 *    could not: *"all lenses are UV 400 protection"*.
 *
 * ── What the sheets say and we still do NOT publish ─────────────────────────
 *
 * - **Gender.** The sheets say "Female", "women", "Neutral" and "General" for
 *   six frames sold as one unisex line. It is the supplier's merchandising
 *   category, not a property of the object, and `Product.gender` is UNISEX on
 *   purpose.
 * - **"Lens Type".** The column is not one kind of fact. For three models it
 *   holds a material (PC, AC) and that goes to `lensMaterial`; for the other
 *   three it holds "HD" or "Clear", which are a marketing word and — on a pair
 *   of sunglasses — a contradiction. Neither is a lens type, so `lensType`
 *   stays null everywhere rather than repeating the sheet's own confusion.
 * - **Filter category.** See `lensCategory` below. This one is not squeamish-
 *   ness, it is a launch blocker.
 */
export type SourceSpecs = {
  /** `Product.frameDetail`, free text. The sheet's "Frame Material". */
  frameDetail: string | null;
  /**
   * `Product.frameMaterial`, the enum the admin filters on.
   *
   * It has no member for polycarbonate, so five of the six are null and only
   * SYNC — which the sheet calls METAL — can be expressed. The string above is
   * what the customer reads; this is only for filtering.
   */
  frameMaterial: "METAL" | null;
  /**
   * `Product.lensMaterial`. Written as the sheet's own token plus its
   * expansion, so the source stays legible next to the word: "Polycarbonate
   * (PC)", "Acrylic (AC)".
   */
  lensMaterial: string | null;
  /** `Product.uvProtection`. "UV400" on all six, confirmed 2026-09-08. */
  uvProtection: string | null;
  /**
   * `Product.lensCategory`, the 0–4 scale of EN ISO 12312-1.
   *
   * ⚠️ NULL ON ALL SIX, AND THIS IS THE ONE BLANK THAT BLOCKS A EU LAUNCH.
   *
   * Max answered on 2026-09-08: *"black lens for your order are all C3, the
   * gradient lens are C2"*. That is two categories, split by a property of the
   * COLOURWAY — and it cannot be written down yet for two separate reasons:
   *
   * 1. **Nobody has said which of our sixteen colourways carry the gradient
   *    lens.** Fifteen of them name their lens "Black" and one does not, but
   *    the factory charts also use 双 ("double") and 渐进 ("gradient") as
   *    different words, and guessing which of ours is which is precisely the
   *    thing this file exists to refuse.
   * 2. **The column is on the product, and the fact is on the variant.** Two
   *    colourways of one model can differ, so a single number per model would
   *    be wrong for at least one of them whatever we chose.
   *
   * So it stays null, the product page omits the row, and the question to Max
   * is one line: which of these sixteen are the gradient ones? Answering it
   * costs a column on ProductVariant and a migration, not a redesign.
   */
  lensCategory: number | null;
  /**
   * `Product.dimensionsMm`, in the trade's own order: lens width, bridge,
   * temple. The sheets give five figures — total width and lens height as
   * well — and those two are dropped rather than invented into the string,
   * because "141-48-17-34-142" is not a notation anybody reads.
   */
  dimensionsMm: string | null;
  /**
   * `Product.weightGrams`, one decimal.
   *
   * ⚠️ The column is a DECIMAL and not an integer for one reason: Amplify
   * weighs 15.4 g. Rounded to 15 it stops being what the supplier wrote, and a
   * spec that is nearly right is the failure mode this whole file guards
   * against.
   */
  weightGrams: number | null;
};

export type SourceProduct = {
  slug: string;
  name: string;
  /** The supplier's model code, printed on the invoice. */
  code: string;
  /**
   * The frame's own unit price in US cents, from invoice YM20260716.
   *
   * NOT what a pair costs: add `PACKAGING_COST_USD_CENTS` for that, which is
   * what `packedCostUsdCents()` below does and what the database stores.
   */
  frameCostUsdCents: number;
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
   * What the supplier has confirmed in writing about this frame, and nothing
   * else. See SourceSpecs.
   */
  specs: SourceSpecs;
  /** The model's photography, in gallery order. See the note below. */
  images: SourceImage[];
  colorways: SourceColorway[];
};

/**
 * The launch photography, delivered by the client on 2026-09-21 in a folder per
 * model ("Allternativ web" in `para nico/archivos varios/`). They are the
 * brand's own renders, made with an image model, and 54 of their 158 are used:
 * five to ten per model, without the near-duplicates. Converted to webp at
 * 1600 px, which took them from 121 MB to 3.9 MB.
 *
 * ⚠️ A photo is hung on a colourway only when that colourway is what it shows,
 * because hung there it is a claim: whoever picks "Mercury Black" is told this
 * is what Mercury Black looks like. A colourway with photos of its own shows
 * only those.
 *
 * `colorway: null` is for a photo that is true of a colourway WITHOUT photos
 * of its own, and it is shown only to those. Corinthian's two distant shots
 * are the one case: the frame is black, which Black / Double Grey's is too.
 *
 * ⚠️ Two colourways have nothing, and show a line saying their photography is
 * on its way rather than another colour's: Orbital Sand Black (a beige frame;
 * every Orbital render is silver or black) and Prism Demi / Black. Checked at
 * full size on 2026-09-21: no render in the folder is colour-neutral enough to
 * stand in, the frames read in all of them.
 *
 * ⚠️ Not used, on purpose: Prism's close-up in a tortoise frame with a PURPLE
 * lens. That is 3980 C6 Demi/Purple, the colourway Max prepared by mistake and
 * that the shop does not sell (see the Prism SKU note below).
 *
 * `/catalog/` still holds the stand-in imagery that was here before, and
 * `PLACEHOLDER_IMAGE_PREFIX` stays so the admin can say whether any is left.
 */
export const PLACEHOLDER_IMAGE_PREFIX = "/catalog/";

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
    frameCostUsdCents: 278,
    name: "The Corinthian",
    code: "89310",
    tagline: "Structured, timeless, slightly untouchable.",
    feeling:
      "Structured, timeless, slightly untouchable. The Corinthian brings a sharper frequency to everyday movement — from slow afternoons to nights that don't need a plan. Made for those who don't follow the room, but somehow change it.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    // Sheet: 89310.pdf p.1. 141 mm across, lens height 34 mm.
    specs: {
      frameDetail: "Polycarbonate (PC)",
      frameMaterial: null,
      lensMaterial: "Polycarbonate (PC)",
      uvProtection: "UV400",
      lensCategory: null,
      dimensionsMm: "48-17-142",
      weightGrams: 22,
    },
    images: [
      { url: "/products/the-corinthian/the-corinthian-01.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/the-corinthian/the-corinthian-02.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/the-corinthian/the-corinthian-03.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/the-corinthian/the-corinthian-04.webp", type: "LIFESTYLE", colorway: "black-black" },
      { url: "/products/the-corinthian/the-corinthian-05.webp", type: "MODEL", colorway: "olive-green" },
      { url: "/products/the-corinthian/the-corinthian-06.webp", type: "MODEL", colorway: "olive-green" },
      { url: "/products/the-corinthian/the-corinthian-07.webp", type: "MODEL", colorway: "olive-green" },
      { url: "/products/the-corinthian/the-corinthian-08.webp", type: "LIFESTYLE", colorway: "olive-green" },
      { url: "/products/the-corinthian/the-corinthian-09.webp", type: "LIFESTYLE", colorway: null },
      { url: "/products/the-corinthian/the-corinthian-10.webp", type: "LIFESTYLE", colorway: null },
    ],
    colorways: [
      {
        key: "olive-green",
        name: "Olive Green",
        sku: "THE-CORINTHIAN_OLIVE-GREEN",
        supplierSku: null,
        swatch: "#7d7a45",
        caseColor: "WHITE",
        stock: 16,
      },
      {
        key: "black-black",
        name: "Black / Black",
        sku: "THE-CORINTHIAN_BLACK-BLACK",
        supplierSku: null,
        swatch: "#16171a",
        caseColor: "WHITE",
        stock: 16,
      },
      {
        key: "black-double-grey",
        name: "Black / Double Grey",
        sku: "THE-CORINTHIAN_BLACK-DOUBLE-GREY",
        supplierSku: null,
        swatch: "#3f4247",
        caseColor: "WHITE",
        stock: 15,
      },
    ],
  },
  {
    slug: "orbital",
    frameCostUsdCents: 250,
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
    // Sheet: the WeChat PDF p.3. 150 mm across, lens height 35 mm.
    specs: {
      frameDetail: "Polycarbonate (PC)",
      frameMaterial: null,
      lensMaterial: "Acrylic (AC)",
      uvProtection: "UV400",
      lensCategory: null,
      dimensionsMm: "65-18-130",
      weightGrams: 34,
    },
    images: [
      { url: "/products/orbital/orbital-01.webp", type: "PRODUCT", colorway: "mercury-black" },
      { url: "/products/orbital/orbital-02.webp", type: "PRODUCT", colorway: "mercury-black" },
      { url: "/products/orbital/orbital-03.webp", type: "DETAIL", colorway: "mercury-black" },
      { url: "/products/orbital/orbital-04.webp", type: "MODEL", colorway: "mercury-black" },
      { url: "/products/orbital/orbital-05.webp", type: "LIFESTYLE", colorway: "mercury-black" },
      { url: "/products/orbital/orbital-06.webp", type: "LIFESTYLE", colorway: "mercury-black" },
      { url: "/products/orbital/orbital-07.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/orbital/orbital-08.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/orbital/orbital-09.webp", type: "LIFESTYLE", colorway: "black-black" },
      { url: "/products/orbital/orbital-10.webp", type: "LIFESTYLE", colorway: "black-black" },
    ],
    colorways: [
      {
        key: "mercury-black",
        name: "Mercury Black",
        sku: "ORBITAL_C03-MERCURY-BLACK",
        supplierSku: null,
        swatch: "#b9bdc2",
        caseColor: "BLACK",
        stock: 16,
      },
      {
        key: "sand-black",
        name: "Sand Black",
        sku: "ORBITAL_C09-SAND-BLACK",
        supplierSku: null,
        swatch: "#b9a68a",
        caseColor: "BLACK",
        stock: 16,
      },
      {
        key: "black-black",
        name: "Black Black",
        sku: "ORBITAL_C07-BLACK-BLACK",
        supplierSku: null,
        swatch: "#16171a",
        caseColor: "BLACK",
        stock: 15,
      },
    ],
  },
  {
    slug: "neon-shift",
    frameCostUsdCents: 260,
    name: "Neon Shift",
    code: "862JT",
    tagline: "Day fades. The frequency changes.",
    feeling:
      "Day fades. The frequency changes. Neon Shift lives in the transition — from golden hour to after dark, from familiar streets to somewhere unexpected. Designed for the hours when everything starts to feel different.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    // Sheet: 862JT.pdf p.17. 151 mm across, lens height 55 mm. Its "Lens
    // Type: HD" is not a material, so lensMaterial stays null.
    specs: {
      frameDetail: "Polycarbonate (PC)",
      frameMaterial: null,
      lensMaterial: null,
      uvProtection: "UV400",
      lensCategory: null,
      dimensionsMm: "68-18-133",
      weightGrams: 32.6,
    },
    images: [
      { url: "/products/neon-shift/neon-shift-01.webp", type: "MODEL", colorway: "red-black" },
      { url: "/products/neon-shift/neon-shift-02.webp", type: "MODEL", colorway: "red-black" },
      { url: "/products/neon-shift/neon-shift-03.webp", type: "PRODUCT", colorway: "black-black" },
      { url: "/products/neon-shift/neon-shift-04.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/neon-shift/neon-shift-05.webp", type: "DETAIL", colorway: "black-black" },
      { url: "/products/neon-shift/neon-shift-06.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/neon-shift/neon-shift-07.webp", type: "PRODUCT", colorway: "black-blue" },
      { url: "/products/neon-shift/neon-shift-08.webp", type: "PRODUCT", colorway: "black-blue" },
      { url: "/products/neon-shift/neon-shift-09.webp", type: "DETAIL", colorway: "black-blue" },
      { url: "/products/neon-shift/neon-shift-10.webp", type: "MODEL", colorway: "black-blue" },
    ],
    colorways: [
      {
        key: "red-black",
        name: "Red / Black",
        sku: "NEON-SHIFT_RED-BLACK",
        supplierSku: null,
        swatch: "#b4322b",
        caseColor: "WHITE",
        stock: 16,
      },
      {
        key: "black-black",
        name: "Black / Black",
        sku: "NEON-SHIFT_BLACK-BLACK",
        supplierSku: null,
        swatch: "#16171a",
        caseColor: "WHITE",
        stock: 16,
      },
      {
        key: "black-blue",
        name: "Black / Blue",
        sku: "NEON-SHIFT_BLACK-BLUE",
        supplierSku: null,
        swatch: "#2a3f6b",
        caseColor: "WHITE",
        stock: 15,
      },
    ],
  },
  {
    slug: "sync",
    frameCostUsdCents: 298,
    name: "SYNC",
    code: "826JT",
    tagline: "Right place. Right people. Right frequency.",
    feeling:
      "Right place. Right people. Right frequency. SYNC is about those rare moments when everything aligns without trying. Clean, instinctive and made to move with you wherever the day turns into night.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    // Sheet: 826JT.pdf p.1. 143 mm across, lens height 43 mm. The only
    // metal frame of the six, and the only one the enum can express.
    specs: {
      frameDetail: "Metal",
      frameMaterial: "METAL",
      lensMaterial: null,
      uvProtection: "UV400",
      lensCategory: null,
      dimensionsMm: "56-18-135",
      weightGrams: 32.7,
    },
    images: [
      { url: "/products/sync/sync-01.webp", type: "PRODUCT", colorway: "gold-black" },
      { url: "/products/sync/sync-02.webp", type: "DETAIL", colorway: "gold-black" },
      { url: "/products/sync/sync-03.webp", type: "MODEL", colorway: "gold-black" },
      { url: "/products/sync/sync-04.webp", type: "LIFESTYLE", colorway: "gold-black" },
      { url: "/products/sync/sync-05.webp", type: "MODEL", colorway: "silver-black" },
      { url: "/products/sync/sync-06.webp", type: "LIFESTYLE", colorway: "silver-black" },
      { url: "/products/sync/sync-07.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/sync/sync-08.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/sync/sync-09.webp", type: "LIFESTYLE", colorway: "black-black" },
    ],
    colorways: [
      {
        key: "gold-black",
        name: "Gold / Black",
        sku: "SYNC_GOLD-BLACK",
        supplierSku: null,
        swatch: "#c6a765",
        caseColor: "BLACK",
        stock: 15,
      },
      {
        key: "silver-black",
        name: "Silver Black",
        sku: "SYNC_SILVER-BLACK",
        supplierSku: null,
        swatch: "#c7cace",
        caseColor: "BLACK",
        stock: 16,
      },
      {
        key: "black-black",
        name: "Black Black",
        sku: "SYNC_BLACK-BLACK",
        supplierSku: null,
        swatch: "#16171a",
        caseColor: "BLACK",
        stock: 16,
      },
    ],
  },
  {
    slug: "amplify",
    frameCostUsdCents: 235,
    name: "Amplify",
    code: "2037JT",
    tagline: "Turn everything up.",
    feeling:
      "Turn everything up. Amplify was made for louder moments — bigger energy, longer nights and the kind of memories that never happen according to plan. Wear the frequency. Make it yours.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "LIVE",
    // Sheet: 2037JT.pdf p.3. 145 mm across, lens height 32 mm. Its "Lens
    // Type: Clear" is a contradiction on a sunglass and is not published.
    specs: {
      frameDetail: "Polycarbonate (PC)",
      frameMaterial: null,
      lensMaterial: null,
      uvProtection: "UV400",
      lensCategory: null,
      dimensionsMm: "67-20-145",
      weightGrams: 15.4,
    },
    images: [
      { url: "/products/amplify/amplify-01.webp", type: "PRODUCT", colorway: "hawksbill-brown" },
      { url: "/products/amplify/amplify-02.webp", type: "PRODUCT", colorway: "hawksbill-brown" },
      { url: "/products/amplify/amplify-03.webp", type: "DETAIL", colorway: "hawksbill-brown" },
      { url: "/products/amplify/amplify-04.webp", type: "DETAIL", colorway: "hawksbill-brown" },
      { url: "/products/amplify/amplify-05.webp", type: "MODEL", colorway: "hawksbill-brown" },
      { url: "/products/amplify/amplify-06.webp", type: "MODEL", colorway: "hawksbill-brown" },
      { url: "/products/amplify/amplify-07.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/amplify/amplify-08.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/amplify/amplify-09.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/amplify/amplify-10.webp", type: "LIFESTYLE", colorway: "black-black" },
    ],
    colorways: [
      {
        key: "black-black",
        name: "Black / Black",
        sku: "AMPLIFY_C01-BLACK-BLACK",
        supplierSku: null,
        swatch: "#16171a",
        caseColor: "BLACK",
        stock: 24,
      },
      {
        key: "hawksbill-brown",
        name: "Hawksbill / Brown",
        sku: "AMPLIFY_C05-HAWKSBILL-BROWN",
        supplierSku: null,
        swatch: "#7b4a26",
        caseColor: "BLACK",
        stock: 24,
      },
    ],
  },
  {
    // DRAFT: the placeholder folders ran out before Prism did, and the only one
    // left is the same gold frame already standing in for SYNC. Rather than show
    // two models with identical imagery, this one stays unpublished. Its codes,
    // colourways and fifty units are recorded all the same, so the launch
    // inventory is complete and flipping it to LIVE is one field.
    slug: "prism",
    frameCostUsdCents: 235,
    name: "Prism",
    code: "3980",
    tagline: "Same light. Different perspective.",
    feeling:
      "Same light. Different perspective. Prism is a reminder that reality changes depending on how you choose to see it. Designed for sunlight, reflections and everything outside the ordinary.",
    priceCents: PRICE_CENTS,
    type: "SUNGLASSES",
    status: "DRAFT",
    // Sheet: 3980JT.pdf p.2, the one sheet written in Chinese. 153 mm
    // across, lens height 29 mm, and the hinge is stamped "3980 49□23-140",
    // which is the same measurement in the trade's own notation.
    specs: {
      frameDetail: "Polycarbonate (PC)",
      frameMaterial: null,
      lensMaterial: "Acrylic (AC)",
      uvProtection: "UV400",
      lensCategory: null,
      dimensionsMm: "49-23-140",
      weightGrams: 34.7,
    },
    images: [
      { url: "/products/prism/prism-01.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/prism/prism-02.webp", type: "MODEL", colorway: "black-black" },
      { url: "/products/prism/prism-03.webp", type: "LIFESTYLE", colorway: "black-black" },
      { url: "/products/prism/prism-04.webp", type: "LIFESTYLE", colorway: "black-black" },
      { url: "/products/prism/prism-05.webp", type: "LIFESTYLE", colorway: "black-black" },
    ],
    colorways: [
      {
        key: "black-black",
        name: "Black / Black",
        sku: "PRISM_C1-BLACK-BLACK",
        supplierSku: null,
        swatch: "#16171a",
        caseColor: "WHITE",
        stock: 24,
      },
      {
        key: "demi-black",
        name: "Demi / Black",
        // ⚠️ C4, NOT C6, and the correction matters because the warehouse reads
        // this string. The invoice line said "C6 Demi/Black", but the factory
        // colour chart for 3980 says C6 is DEMI/PURPLE and C4 is DEMI/BLACK —
        // so the invoice asserted two different things at once. Asked, and Max
        // answered on 2026-09-08: he had prepared both lenses and "made a
        // mistake with purple lens", having understood we wanted the black one.
        //
        // Whichever way the remaining ambiguity falls, `C6` beside the word
        // BLACK cannot be right: either the code is wrong or the colourway name
        // is. This pairs the code with what the shop actually sells.
        //
        // ⬜ Prism is DRAFT, so nothing is on sale under either code, but the
        // list of 32 SKUs already went to Daniel. It needs resending, and Max
        // needs to confirm in one line that the 25 units are the black lens.
        sku: "PRISM_C4-DEMI-BLACK",
        supplierSku: null,
        swatch: "#6b4423",
        caseColor: "WHITE",
        stock: 24,
      },
    ],
  },
];

/**
 * What one PACKED pair costs, in US cents: the frame plus everything that ships
 * with it. This is the figure the database stores and the figure a margin is
 * worked out against.
 *
 * Ranges from 540 (Amplify, Prism) to 603 (SYNC) against a EUR 39 sale.
 */
export function packedCostUsdCents(product: SourceProduct): number {
  return product.frameCostUsdCents + PACKAGING_COST_USD_CENTS;
}

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
