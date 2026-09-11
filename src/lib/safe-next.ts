/**
 * Where a sign-in is allowed to send somebody afterwards.
 *
 * ⚠️ `?next=` comes off the URL, which means it comes from whoever wrote the
 * link. Handed to `redirect()` or `router.push()` unchecked it is an open
 * redirect: a link to our own login page that lands the visitor on somebody
 * else's site, wearing our domain in the address bar the whole way there. On a
 * shop that takes card details that is the shape of a phishing page — and it
 * is worse than the usual one, because the victim has just watched a real
 * login succeed on the real domain before being handed over.
 *
 * ── Why this resolves a URL instead of checking prefixes ────────────────────
 *
 * The first version of this function rejected `//` and `/\` and let everything
 * else starting with `/` through. A security review found the hole, and it is
 * a good lesson in why enumerating bad prefixes loses:
 *
 *     "/<TAB>/evil.example"  →  passed  →  https://evil.example/
 *     "/<LF>/evil.example"   →  passed  →  https://evil.example/
 *     "/<CR>/evil.example"   →  passed  →  https://evil.example/
 *
 * The WHATWG URL parser — the one in the browser, in `new URL`, and in Next's
 * router — **strips every ASCII tab and newline from the input before it parses
 * anything.** So `/<TAB>/evil.example` is not a path that begins with a slash
 * and a tab; by the time anything looks at it, it is `//evil.example`, which is
 * protocol-relative. `searchParams` hands the decoded tab straight through, so
 * `?next=%2F%09%2Fevil.example` is all it takes. Verified against Node's URL.
 *
 * A prefix list can only ever block the shapes somebody thought of. So this
 * asks the parser itself, against a placeholder origin: resolve the value, and
 * keep it only if it stayed on that origin. Anything that escapes — an
 * absolute URL, a protocol-relative one, a backslash, a tab, a newline, or the
 * next trick nobody has thought of — changes the origin and is refused by the
 * same line.
 */
export function safeNext(raw: string | undefined, fallback = "/account"): string {
  if (!raw) return fallback;

  // An origin that cannot exist, so "stayed here" cannot be satisfied by
  // reaching a real host. `.invalid` is reserved by RFC 2606 for exactly this.
  const PLACEHOLDER = "https://placeholder.invalid";

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER);
  } catch {
    return fallback;
  }

  if (url.origin !== PLACEHOLDER) return fallback;

  // Rebuilt from the parsed parts rather than returned as typed, so what the
  // caller redirects to is exactly what was validated — no tabs, no newlines,
  // no second interpretation further down.
  const path = `${url.pathname}${url.search}${url.hash}`;

  // A resolved path always starts with "/", but say so rather than assume it:
  // this value is about to be a Location header.
  return path.startsWith("/") ? path : fallback;
}
