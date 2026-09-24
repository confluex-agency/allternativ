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
// Sixteen rows, one per colourway. There used to be thirty-two, one per case
// colour, because the shopper picked the case. Daniel's inventory of 2026-09-22
// showed each colourway packed in a single case with none spare, so only the
// half of his sheet that holds stock is real, and that half is this list.
//
// Generated rather than typed so it cannot drift from the catalogue. It reads
// `catalogue-source.ts`, not the database, on purpose: this is what we intend
// to sell, and a half-seeded database would quietly produce a short list.

import { catalogueProducts } from "../src/lib/catalogue-source";
import { fulfilmentSku } from "../src/lib/sku";

const rows = [
  ["SKU", "Model", "Model code", "Sunglass colour", "Case colour", "Status"],
];

for (const product of catalogueProducts) {
  for (const colorway of product.colorways) {
    rows.push([
      fulfilmentSku(colorway.sku, colorway.caseColor),
      product.name,
      product.code ?? "",
      colorway.name,
      colorway.caseColor,
      product.status,
    ]);
  }
}

// Quote every field: colour names contain slashes and commas, and this file is
// opened in Excel by somebody in another country before anybody notices.
for (const row of rows) {
  console.log(row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","));
}
