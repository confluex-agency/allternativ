import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/staging";

// Crawlers are refused entirely on a preview, and given the ordinary rules on
// the real shop.
//
// ⚠️ There must be NO public/robots.txt beside this. A static file in /public
// shadows this route entirely, and the first version of this shipped both: the
// static one said "Disallow: /" as a safe default, which would have quietly
// de-indexed the real shop the day it launched. Verified by serving a
// production build and reading what came back. The admin and the API are off limits either way: neither has
// anything a search result should ever show, and the supplier facade under
// /wp-json exists for one machine in Shenzhen.
export default function robots(): MetadataRoute.Robots {
  if (isStaging) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/wp-json/", "/cart", "/checkout/"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sitemap.xml`,
  };
}
