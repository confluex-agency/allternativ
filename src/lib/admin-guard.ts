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
 * Call it at the top of every protected admin page. When the admin grows past
 * a couple of screens, this belongs in a route-group layout instead of being
 * repeated — but with two pages, repeating it is clearer than restructuring.
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
