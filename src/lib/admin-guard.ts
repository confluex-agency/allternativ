import { redirect } from "next/navigation";
import { getAuthFromCookies, type JWTPayload } from "@/lib/auth";
import type { AdminRole } from "@/generated/prisma/enums";

/**
 * Guards an admin PAGE on the server.
 *
 * `src/proxy.ts` already turns anonymous visitors away at the edge, but it only
 * verifies the token's signature. It cannot check `passwordChangedAt`, because
 * that needs a database read on every request — too expensive for middleware,
 * and not what middleware is for.
 *
 * The consequence, before this existed: someone whose account was taken over
 * changed their password, which killed the stolen token for every API route
 * (they all go through getAuthFromCookies), and the attacker could still open
 * the admin pages with it. This closes that, because it goes through the same
 * function the API routes do.
 *
 * Call it at the top of every protected admin page.
 *
 * ⚠️ This used to say "with two pages, repeating it is clearer than
 * restructuring", and promise a route-group layout once the admin grew past a
 * couple of screens. **It has**: six pages call this now — the dashboard,
 * orders and its detail, products and its detail, and change-password. The
 * condition the comment set for itself has been met, so the note is no longer
 * a reason to leave it alone, it is a TODO.
 *
 * The reason it has not moved yet is that the two halves do not take the same
 * roles: orders is `COMMERCIAL_ROLES`, products and the dashboard are any
 * signed-in admin. A single layout guard would have to be the weakest of them
 * and the stricter pages would still need their own call — which is how a
 * guard ends up looking present and being absent. Splitting the route group is
 * the real fix.
 */
export async function requireAdminPage(
  ...allowed: AdminRole[]
): Promise<JWTPayload> {
  const user = await getAuthFromCookies();
  if (!user) redirect("/admin/login");

  // No roles listed means "any signed-in admin".
  if (allowed.length > 0 && !allowed.includes(user.role)) {
    // Deliberately back to the dashboard rather than to the login page: the
    // person IS signed in, and bouncing them to a login form they have already
    // passed is the kind of thing that makes people think the site is broken.
    redirect("/admin");
  }

  return user;
}
