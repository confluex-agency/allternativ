import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isStaging, stagingPassword } from "@/lib/staging";

const COOKIE_NAME = "allternativ-admin-token";

// ── The staging gate ───────────────────────────────────────────────────────
//
// A preview deployment is for the two founders to review, which is not the same
// as being open to whoever finds the address. One shared password, over HTTP
// Basic auth, because it works on a phone with no app, no account and no
// explaining.
//
// ⚠️ TWO PATHS ARE DELIBERATELY LEFT OPEN, and forgetting either of them turns
// a preview into a broken integration rather than a private one:
//
//   /api/webhooks/*  Stripe calls this to tell us a payment happened. Gated, it
//                    would retry, fail, and eventually give up, and the order
//                    would never exist. Stripe verifies its own signature, so
//                    the route is not unguarded, only unpasassworded.
//   /wp-json/*       The supplier's system reads orders here and writes tracking
//                    back. It authenticates with its own consumer key.
//
// Both check credentials of their own. The password is for humans.
const OPEN_PREFIXES = ["/api/webhooks", "/wp-json"];

function stagingGate(request: NextRequest): NextResponse | null {
  if (!isStaging) return null;
  const { pathname } = request.nextUrl;
  if (OPEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      // Everything after the first colon: a password may contain one, a
      // username may not, and splitting naively would lock out a good password.
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (supplied === stagingPassword) return null;
    } catch {
      // A malformed header is simply not a valid password.
    }
  }

  return new NextResponse("This preview is private.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Allternativ preview", charset="UTF-8"',
      // Belt and braces with robots.ts: a 401 is not indexable anyway, but the
      // header costs nothing and covers the moment the gate is switched off.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    "[proxy] JWT_SECRET must be set and at least 32 characters",
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function proxy(request: NextRequest) {
  const gated = stagingGate(request);
  if (gated) return gated;

  const { pathname } = request.nextUrl;

  // Protect all /admin routes except /admin/login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and the files served straight from
  // /public. The admin check below still only looks at /admin; widening the
  // matcher is what lets the staging gate see the storefront at all.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|glb|mp4)$).*)"],
};
