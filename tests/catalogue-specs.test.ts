import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  catalogueProducts,
  PLACEHOLDER_IMAGE_PREFIX,
} from "@/lib/catalogue-source";

// The published specification is the one part of the catalogue where being
// nearly right is worse than being empty. The client's instruction is literal:
// "no queremos que se infiera ni se invente ninguna especificación que no esté
// confirmada por el proveedor", and the catalogue this replaced carried a frame
// material, a lens material and "Handcrafted · LATAM" on goods made in China.
//
// Nothing here can check a transcription against a PDF - the sheets are page
// images and they live in the vault, not in the repository. What it can check is
// the shape of the claim, which is where the mistakes of this kind actually
// happen: a value copied to the model beside it, a decimal rounded away, a
// blank quietly filled in because the row looked untidy.

describe("the transcribed specs", () => {
  it("gives every model a frame, a UV rating, dimensions and a weight", () => {
    // Six sheets arrived, six models are described. A null in any of these four
    // now means a transcription was dropped, not that the data is missing.
    for (const p of catalogueProducts) {
      expect(p.specs.frameDetail, p.slug).toBeTruthy();
      expect(p.specs.uvProtection, p.slug).toBe("UV400");
      expect(p.specs.dimensionsMm, p.slug).toMatch(/^\d{2}-\d{2}-\d{3}$/);
      expect(p.specs.weightGrams, p.slug).toBeGreaterThan(0);
    }
  });

  it("keeps the lens filter category unpublished on every model", () => {
    // ⚠️ THIS TEST IS MEANT TO FAIL ONE DAY, DELIBERATELY.
    //
    // Max answered on 2026-09-08 that the black lenses are C3 and the gradient
    // ones C2 - two categories split by a property of the colourway, and nobody
    // has yet said which of our sixteen colourways is which. Until they do, a
    // number on the product would be wrong for at least one of its colourways.
    //
    // When that answer arrives the fix is a column on ProductVariant, not a
    // value here, so whoever deletes this test should be moving the field, not
    // filling this one in.
    for (const p of catalogueProducts) {
      expect(p.specs.lensCategory, p.slug).toBeNull();
    }
  });

  it("does not repeat one model's weight or dimensions on another", () => {
    // The failure this guards is copy-paste between six near-identical blocks.
    // Two frames can legitimately weigh the same, but not to a tenth of a gram
    // and with the same three measurements, and none of the six sheets do.
    const seen = new Set<string>();
    for (const p of catalogueProducts) {
      const fingerprint = `${p.specs.dimensionsMm}|${p.specs.weightGrams}`;
      expect(seen.has(fingerprint), `${p.slug} duplicates ${fingerprint}`).toBe(
        false,
      );
      seen.add(fingerprint);
    }
  });

  it("carries a factory colour code only where the chart agrees with it", () => {
    // ⚠️ This is the Prism defect of 2026-09-08, made impossible to reintroduce.
    //
    // The SKU read `PRISM_C6-DEMI-BLACK` while the factory chart for 3980 says
    // C6 is DEMI/PURPLE and C4 is DEMI/BLACK. Two assertions about one physical
    // object, one of them necessarily false, in the string the warehouse picks
    // by. Nothing in the code could notice, because the code has never known
    // what the supplier's codes mean.
    //
    // Now it does, for the seven colourways whose SKU carries one. Transcribed
    // from the "AVAILABLE COLORS" / "EXHIBITION" pages of Max's own catalogues,
    // which are the same documents the specs above come from. A code we do not
    // have a chart for is left out of the table rather than guessed - that is
    // why the assertion below skips them instead of failing.
    const FACTORY_COLOUR_CHART: Record<string, Record<string, string>> = {
      // 5119JT, the WeChat PDF pages 1-12.
      orbital: { C03: "MERCURY BLACK", C07: "BLACK BLACK", C09: "SAND BLACK" },
      // 2037JT.
      amplify: { C01: "BLACK BLACK", C05: "HAWKSBILL BROWN" },
      // 3980, the same PDF pages 13-24. C6 is DEMI/PURPLE and we do not sell it.
      prism: { C1: "BLACK BLACK", C4: "DEMI BLACK", C6: "DEMI PURPLE" },
    };

    let checked = 0;
    for (const p of catalogueProducts) {
      const chart = FACTORY_COLOUR_CHART[p.slug];
      if (!chart) continue;
      for (const cw of p.colorways) {
        const code = (cw.sku.split("_")[1] ?? "").match(/^(C\d+)-/)?.[1];
        if (!code) continue;
        const normalise = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
        expect(chart[code], `${cw.sku}: no chart entry for ${code}`).toBeTruthy();
        expect(normalise(chart[code]), `${cw.sku} vs "${cw.name}"`).toBe(
          normalise(cw.name),
        );
        checked += 1;
      }
    }
    // Guards the guard: a rename that drops every code would otherwise leave
    // this test passing over nothing.
    expect(checked).toBe(7);
  });
});

// A photo hung on a colourway is a claim about what that colourway looks like.
// These hold the ways the source file can make that claim wrongly without
// anything failing: a key that names no colourway, and a colourway quietly left
// with an empty gallery. The seed throws on the first; nothing else would
// notice the second.
describe("the photography", () => {
  it("hangs every photo on a colourway the model has, or on none", () => {
    for (const p of catalogueProducts) {
      const keys = new Set(p.colorways.map((c) => c.key));
      for (const img of p.images) {
        if (img.colorway !== null) {
          expect(keys.has(img.colorway), `${p.slug}: ${img.url}`).toBe(true);
        }
      }
    }
  });

  it("leaves only the known colourways without photography", () => {
    // A colourway with nothing shows a line saying its photos are on their way
    // (decided 2026-09-21) rather than another colour's. That is a deliberate
    // state, so it is listed here: filling one in, or losing one by accident,
    // has to change this list.
    const withoutPhotos = catalogueProducts.flatMap((p) => {
      const shared = p.images.some((i) => i.colorway === null);
      return p.colorways
        .filter((c) => !shared && !p.images.some((i) => i.colorway === c.key))
        .map((c) => `${p.slug}/${c.key}`);
    });
    expect(withoutPhotos.sort()).toEqual(["orbital/sand-black", "prism/demi-black"]);
  });

  it("uses shared photos only where some colourway has none of its own", () => {
    // A shared photo is shown ONLY to colourways without their own, so on a
    // model where every colourway has photos it would never be seen.
    for (const p of catalogueProducts) {
      if (!p.images.some((i) => i.colorway === null)) continue;
      const bare = p.colorways.filter(
        (c) => !p.images.some((i) => i.colorway === c.key),
      );
      expect(bare.length, p.slug).toBeGreaterThan(0);
    }
  });

  it("uses none of the stand-in imagery", () => {
    for (const p of catalogueProducts) {
      for (const img of p.images) {
        expect(img.url.startsWith(PLACEHOLDER_IMAGE_PREFIX), img.url).toBe(false);
        expect(
          existsSync(join(process.cwd(), "public", img.url)),
          `${img.url} is not in public/`,
        ).toBe(true);
      }
    }
  });
});
