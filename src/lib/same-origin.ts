import type { NextRequest } from "next/server";

/**
 * The page that posted is on the host that received it.
 *
 * Compared against the request's own host rather than `NEXT_PUBLIC_APP_URL`,
 * because the shop may answer on more than one name (with and without `www.`,
 * staging and production) and a form that refused its own domain would fail
 * silently for whoever arrived by the other one.
 *
 * Not a bot filter: a script can send any header it likes. It stops another
 * site from posting through a visitor's browser. Shared by every public form.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
