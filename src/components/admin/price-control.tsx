"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Change one market's price, from the row it belongs to (C5).
//
// The rules live in `src/lib/prices-admin.ts`: the write only lands if the row
// still shows what this form was rendered with, and a figure that would sell
// below cost is refused. This component only collects the three things the
// route needs and shows the refusal in the person's own screen.
//
// "Every model" is ticked by default because that is how the client prices:
// one figure per market for the whole line. Unticking it is the exception.

export function PriceControl({
  slug,
  market,
  marketLabel,
  currency,
  priceCents,
}: {
  slug: string;
  market: string;
  marketLabel: string;
  currency: string;
  /** What this row shows now. Null when the market has no price of its own. */
  priceCents: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    priceCents === null ? "" : (priceCents / 100).toFixed(2),
  );
  const [allModels, setAllModels] = useState(true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    // Typed in whole units with a decimal point, stored in minor units. Read
    // as text and split, not multiplied as a float: 0.1 * 100 is not 10.
    const match = amount.trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/);
    if (!match) {
      setError("Write the price like 39 or 39.90.");
      return;
    }
    const cents =
      Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    if (cents <= 0) {
      setError("A price has to be more than zero.");
      return;
    }
    if (cents === priceCents) {
      setError("That is the price already.");
      return;
    }
    if (!reason.trim()) {
      setError("Say why, in a few words. Somebody will read this later.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${slug}/prices`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          priceCents: cents,
          // ⚠️ The figure this component was rendered with, never one read at
          // submit time: reading it fresh would always agree with itself.
          expected: priceCents,
          allModels,
          reason: reason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        if (res.status === 409) router.refresh();
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-3 text-xs text-neutral-500 underline hover:text-black"
      >
        Change
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border bg-neutral-50 p-3 text-left">
      <p className="text-xs text-neutral-500">
        {marketLabel}, in {currency.toUpperCase()}
      </p>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="39.00"
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={allModels}
          onChange={(e) => setAllModels(e.target.checked)}
        />
        Every model in the line (the usual case)
      </label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Why? e.g. launch price, new positioning in the UK"
        className="w-full rounded border px-2 py-1 text-sm"
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded bg-neutral-900 px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="text-xs text-neutral-500 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
