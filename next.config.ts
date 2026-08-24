import type { NextConfig } from "next";

// React's dev RSC runtime uses eval() for debugging (callstacks). It is NEVER
// used in production, so we only relax script-src in development and keep the
// production CSP strict.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // blob: + data: let three.js GLTFLoader fetch embedded GLB textures (loaded as
  // blob/ImageBitmap), otherwise 3D models render untextured.
  // Supabase was removed from this project in August; its host came out of the
  // policy with it. A connect-src entry for a service nobody calls is a hole
  // that only widens what a compromised script could reach.
  "connect-src 'self' blob: data: https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  // Forces subresources to HTTPS. In dev this breaks LAN access from other
  // devices (phones on the local IP), which is plain HTTP, so only send it in
  // production.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  // The database driver has to reach the deploy as a real module.
  //
  // Next bundles server dependencies into its output chunks, and the deployed
  // node_modules carries only what the dependency tracer could follow.
  // `@prisma/client` is on Next's own auto-external list, so it survives.
  // `@prisma/adapter-mariadb` is not on that list, so its code gets inlined
  // into the chunks -- and `mariadb`, which the adapter requires dynamically,
  // is invisible to the tracer and never ships at all.
  //
  // The deploy that taught us this had 13 packages in node_modules and no
  // driver. Prisma could not open a single connection and reported
  // `pool timeout ... active=0 idle=0`, which reads like a saturated database
  // and was in fact a missing `require`. It cost most of a night, because the
  // build had already failed once with the identical message for an unrelated
  // reason (the build container has no route to MySQL). Same words, three
  // different causes -- so read `active=0` as "never connected", and then work
  // out why.
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb"],

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Section 02 of the brief: "COLLECTIONS is the main ecommerce entry point."
  // Two grids used to compete for that job and neither was it.
  //
  // `/catalogo` was a hardcoded lookbook: nine tiles and a headline written for
  // one model, in Spanish on an English site, reachable from exactly one link.
  // `/products` was a second grid with type filters for categories the brief
  // says not to create; with every piece a pair of sunglasses the filter row
  // hid itself, leaving a plain list of everything.
  //
  // Permanent, not temporary: these URLs are not coming back, and a 308 is what
  // tells a search engine that. `/products/<slug>` is untouched — product pages
  // keep their own URLs.
  async redirects() {
    return [
      { source: "/catalogo", destination: "/collections", permanent: true },
      { source: "/products", destination: "/collections", permanent: true },
    ];
  },
};

export default nextConfig;
