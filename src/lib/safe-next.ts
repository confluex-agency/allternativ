/**
 * Where a sign-in is allowed to send somebody afterwards.
 *
 * ⚠️ `?next=` comes off the URL, which means it comes from whoever wrote the
 * link. Handed to `router.push` unchecked it is an open redirect: a link to
 * our own login page that lands the visitor on somebody else's site, wearing
 * our domain in the address bar all the way there. That is the shape of a
 * phishing page, and the shop takes card details.
 *
 * So only a path on this site is allowed through. `//evil.example` is rejected
 * with it, because a protocol-relative URL starts with a slash too and is very
 * much not a path.
 */
export function safeNext(raw: string | undefined, fallback = "/account"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  // A backslash is treated as a slash by some browsers when normalising a URL,
  // so `/\evil.example` can escape the same way `//` does.
  if (raw.startsWith("/\\")) return fallback;
  return raw;
}
