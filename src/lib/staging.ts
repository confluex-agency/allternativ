// Whether this deployment is a preview rather than the shop.
//
// Staging carries real brand copy, real prices and real product names, and its
// legal pages are explicitly not final. Two things follow from that, and both
// are easy to forget until the damage is done:
//
//   1. Search engines must not index it. A half-built shop in Google under the
//      brand's own name outlives the staging server by months, and the pages it
//      caches are the ones marked "not final yet".
//   2. Strangers must not browse it. It is for the two founders to review,
//      which is a different thing from being open.
//
// Both are driven by one variable. Set STAGING_PASSWORD and the deployment
// becomes a private preview; leave it unset and it behaves as production.
export const stagingPassword = process.env.STAGING_PASSWORD ?? "";

export const isStaging = stagingPassword.length > 0;
