import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, COMMERCIAL_ROLES } from "@/lib/auth";
import { MARKETS, type MarketKey } from "@/lib/markets";
import { setMarketPrice } from "@/lib/prices-admin";
import { formatCurrency } from "@/lib/utils";

// Change a market price (C5). The rules are in `prices-admin.ts`.
//
// COMMERCIAL_ROLES, like stock: a price is money, and section 18 gives pricing
// to ECOMMERCE_ADMIN and not to CONTENT_ADMIN.

const MARKET_KEYS = Object.keys(MARKETS) as [MarketKey, ...MarketKey[]];

const BodySchema = z.object({
  market: z.enum(MARKET_KEYS),
  // Minor units. The ceiling is a typo guard, not a policy: 1,000 in any of
  // the six currencies is far above anything this line sells at.
  priceCents: z.number().int().min(1).max(100_000),
  expected: z.number().int().nullable(),
  allModels: z.boolean().default(false),
  reason: z.string().trim().min(1, "Say why the price changed").max(500),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireRole(...COMMERCIAL_ROLES);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const { slug } = await params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error?.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const currency = MARKETS[body.market].currency;

  const result = await setMarketPrice({ slug, ...body, actor: auth.user });

  if (result.ok) {
    // The shop pages are ISR with a 60-second window. Without this a price
    // change shows in the admin at once and in the shop up to a minute later,
    // which reads as the save not having worked. The checkout never waits:
    // it prices against the database on every request.
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/collections/[slug]", "page");
    revalidatePath("/");
    revalidatePath("/collections");
    return NextResponse.json({ changed: result.changed });
  }

  if (result.reason === "not-found") {
    return NextResponse.json({ error: "No such model" }, { status: 404 });
  }

  if (result.reason === "below-cost") {
    const { worst } = result;
    return NextResponse.json(
      {
        error:
          `At ${formatCurrency(body.priceCents, currency)}, ${result.name} would ` +
          `lose money: ${worst.pairs} pair${worst.pairs === 1 ? "" : "s"} to ` +
          `${worst.country} would leave ${formatCurrency(worst.netCents, currency)} ` +
          `after the goods, the parcel and the card fee. Nothing was changed.`,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      error:
        "The price changed while you were editing, so nothing was written. " +
        "Now: " +
        result.stale
          .map(
            (s) =>
              `${s.name} ${
                s.priceCents === null
                  ? "not set"
                  : formatCurrency(s.priceCents, currency)
              }`,
          )
          .join(", ") +
        ".",
    },
    { status: 409 },
  );
}
