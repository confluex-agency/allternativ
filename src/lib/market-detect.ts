import type { MarketKey } from "@/lib/markets";

// Guessing which of the six markets somebody is in, from their browser.
//
// ── Why the time zone and not the IP ───────────────────────────────────────
// The obvious answer is an IP lookup, and it is the wrong one here. It needs a
// service, which means latency on every page and one more thing that can be
// down; on shared hosting we do not even know yet whether a country header
// reaches the app. And it is not more accurate: a VPN moves the IP and leaves
// the clock alone, so somebody in Madrid connected through a London exit node
// is read as British by an IP and as Spanish by this.
//
// The browser's own time zone costs nothing, answers instantly, works offline,
// and only has to separate six buckets rather than name a country. It is the
// right tool for a question this coarse.
//
// ⚠️ It is a GUESS and is treated as one: it only ever fills an empty choice,
// never overrides one, and an unrecognised zone leaves the choice empty rather
// than inventing a market. Somebody who has said where they are is never
// second-guessed by a clock.

const ZONE_TO_MARKET: Record<string, MarketKey> = {};

const add = (market: MarketKey, zones: string[]) => {
  for (const z of zones) ZONE_TO_MARKET[z] = market;
};

// The 27 EU countries we ship to. Listed rather than matched on "Europe/",
// because that prefix also covers Switzerland, Norway, Moscow and Istanbul,
// none of which are markets of ours.
add("EU", [
  "Europe/Vienna", "Europe/Brussels", "Europe/Sofia", "Europe/Nicosia",
  "Asia/Nicosia", "Europe/Prague", "Europe/Berlin", "Europe/Busingen",
  "Europe/Copenhagen", "Europe/Tallinn", "Europe/Madrid", "Africa/Ceuta",
  "Atlantic/Canary", "Europe/Helsinki", "Europe/Paris", "Europe/Athens",
  "Europe/Zagreb", "Europe/Budapest", "Europe/Dublin", "Europe/Rome",
  "Europe/Vilnius", "Europe/Luxembourg", "Europe/Riga", "Europe/Malta",
  "Europe/Amsterdam", "Europe/Warsaw", "Europe/Lisbon", "Atlantic/Madeira",
  "Atlantic/Azores", "Europe/Bucharest", "Europe/Stockholm",
  "Europe/Ljubljana", "Europe/Bratislava",
]);

add("GB", ["Europe/London", "Europe/Belfast", "Europe/Guernsey",
  "Europe/Isle_of_Man", "Europe/Jersey"]);

// The United States and Canada share a continent and a prefix, so both are
// listed in full rather than inferred. Getting these two the wrong way round
// would show a Canadian dollars they do not use.
add("US", [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "America/Adak", "America/Juneau", "America/Sitka", "America/Nome",
  "America/Yakutat", "America/Metlakatla", "America/Detroit",
  "America/Boise", "America/Menominee", "America/Indiana/Indianapolis",
  "America/Indiana/Knox", "America/Indiana/Marengo",
  "America/Indiana/Petersburg", "America/Indiana/Tell_City",
  "America/Indiana/Vevay", "America/Indiana/Vincennes",
  "America/Indiana/Winamac", "America/Kentucky/Louisville",
  "America/Kentucky/Monticello", "America/North_Dakota/Beulah",
  "America/North_Dakota/Center", "America/North_Dakota/New_Salem",
  "Pacific/Honolulu",
]);

add("CA", [
  "America/Toronto", "America/Vancouver", "America/Edmonton",
  "America/Winnipeg", "America/Halifax", "America/St_Johns",
  "America/Regina", "America/Swift_Current", "America/Whitehorse",
  "America/Dawson", "America/Dawson_Creek", "America/Fort_Nelson",
  "America/Inuvik", "America/Yellowknife", "America/Iqaluit",
  "America/Rankin_Inlet", "America/Resolute", "America/Cambridge_Bay",
  "America/Moncton", "America/Glace_Bay", "America/Goose_Bay",
  "America/Nipigon", "America/Thunder_Bay", "America/Rainy_River",
  "America/Atikokan", "America/Blanc-Sablon", "America/Creston",
]);

add("AU", [
  "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane",
  "Australia/Perth", "Australia/Adelaide", "Australia/Hobart",
  "Australia/Darwin", "Australia/Canberra", "Australia/Broken_Hill",
  "Australia/Lindeman", "Australia/Lord_Howe", "Australia/Eucla",
  "Antarctica/Macquarie",
]);

add("NZ", ["Pacific/Auckland", "Pacific/Chatham"]);

/**
 * The visitor's market, or null when we cannot tell.
 *
 * Null is a real answer and the common one for anywhere outside the six
 * markets. The caller shows the default market and says nothing, which is
 * exactly right: we do not deliver there, so there is no price to guess at.
 */
export function detectMarket(): MarketKey | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone ? (ZONE_TO_MARKET[zone] ?? null) : null;
  } catch {
    // Some privacy-hardened browsers refuse to resolve a time zone at all.
    return null;
  }
}
