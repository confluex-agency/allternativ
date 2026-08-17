"use client";

const VISITOR_COOKIE = "alt_vid";
const SESSION_KEY = "alt_sid";
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
// 30 seconds, not 5.
//
// Every flush is one request to /api/tracking, and that endpoint checks a rate
// limit on Upstash, so the cost of analytics scales with visitors — not with
// anything the shop earns. Batching the same events into fewer requests cuts
// that several times over, and it takes load off our own server too.
//
// Nothing is lost by waiting: `flush()` skips an empty buffer, it fires early
// once 50 events pile up, and the visibilitychange handler flushes with
// sendBeacon when the tab is hidden or closed. The only difference is that a
// figure on the dashboard may be up to half a minute behind, which for a shop
// that is not selling yet is not a cost at all.
const FLUSH_INTERVAL = 30000; // 30 seconds

let visitorId: string;
let sessionId: string;
let lastActivity: number;
let buffer: Array<{
  eventType: string;
  pagePath: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}> = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function generateId(): string {
  return crypto.randomUUID();
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function getSessionId(): string {
  const stored = sessionStorage.getItem(SESSION_KEY);
  const now = Date.now();

  if (stored && lastActivity && now - lastActivity < IDLE_TIMEOUT) {
    return stored;
  }

  const newId = generateId();
  sessionStorage.setItem(SESSION_KEY, newId);
  return newId;
}

function getUtmParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return utm;
}

async function flush() {
  if (buffer.length === 0) return;
  const events = [...buffer];
  buffer = [];

  const payload = {
    visitorId,
    sessionId,
    events,
    utm: getUtmParams(),
    referrer: document.referrer || undefined,
  };

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/tracking",
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );
    } else {
      await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch {
    // Re-add events to buffer on failure
    buffer.unshift(...events);
  }
}

function track(
  eventType: string,
  metadata?: Record<string, unknown>
) {
  lastActivity = Date.now();
  sessionId = getSessionId();

  buffer.push({
    eventType,
    pagePath: window.location.pathname,
    timestamp: new Date().toISOString(),
    metadata,
  });

  if (buffer.length >= 50) flush();
}

export function initTracking() {
  if (typeof window === "undefined") return;

  // Visitor ID (persistent cookie)
  visitorId = getCookie(VISITOR_COOKIE) || generateId();
  setCookie(VISITOR_COOKIE, visitorId, 365);

  // Session ID
  lastActivity = Date.now();
  sessionId = getSessionId();

  // Auto-track page views
  track("page_view");

  // Flush on interval
  flushTimer = setInterval(flush, FLUSH_INTERVAL);

  // Flush on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  // Scroll depth tracking (debounced)
  let maxScroll = 0;
  let scrollTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener("scroll", () => {
    const scrollPercent = Math.round(
      ((window.scrollY + window.innerHeight) /
        document.documentElement.scrollHeight) *
        100
    );
    if (scrollPercent > maxScroll) maxScroll = scrollPercent;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      track("scroll", { depth: maxScroll });
    }, 1000);
  });
}

// Explicit tracking functions
export function trackProductView(productId: string, productName: string) {
  track("product_view", { productId, productName });
}

export function trackSearch(query: string, resultCount: number) {
  track("search", { query, resultCount });
}

export function trackAddToCart(productId: string, quantity: number) {
  track("add_to_cart", { productId, quantity });
}

export function trackCheckoutStart(itemCount: number, totalCents: number) {
  track("checkout_start", { itemCount, totalCents });
}

export function trackPurchase(orderId: string, totalCents: number) {
  track("purchase", { orderId, totalCents });
}

export function cleanup() {
  if (flushTimer) clearInterval(flushTimer);
  flush();
}
