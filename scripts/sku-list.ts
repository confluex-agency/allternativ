// Prints the SKU list for the supplier, as CSV.
//
//   npm run sku:list > skus.csv
//
// Daniel does not have a code of his own for each colourway; he asked us to
// define them ("SKUs should be created on your side... 'Model Name_Sunglass
// Colour_Case Colour'", 2026-08-21). So this list is not a report, it is the
// thing his warehouse has to load before the first order arrives. A SKU that
// reaches Dianxiaomi without being on it has nothing to map to.
//
// There are thirty-two rows and not sixteen because the customer picks the case
// colour, and a black case and a white case are two different things to pick
// off a shelf.
//
// Generated rather than typed so it cannot drift from the catalogue. It reads
// `catalogue-source.ts`, not the database, on purpose: this is what we intend
// to sell, and a half-seeded database would quietly produce a short list.

import {
  catalogueProducts,
  CASE_OPENING_STOCK,
} from "../src/lib/catalogue-source";
import { fulfilmentSku } from "../src/lib/sku";

const caseColors = Object.keys(CASE_OPENING_STOCK);

const rows = [
  ["SKU", "Model", "Model code", "Sunglass colour", "Case colour", "Status"],
];

for (const product of catalogueProducts) {
  for (const colorway of product.colorways) {
    for (const caseColor of caseColors) {
      rows.push([
        fulfilmentSku(colorway.sku, caseColor),
        product.name,
        product.code ?? "",
        colorway.name,
        caseColor,
        product.status,
      ]);
    }
  }
}

// Quote every field: colour names contain slashes and commas, and this file is
// opened in Excel by somebody in another country before anybody notices.
for (const row of rows) {
  console.log(row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","));
}
