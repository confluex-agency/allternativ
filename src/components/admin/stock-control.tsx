"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Change the stock on one colourway, from the row it belongs to.
//
// ⚠️ Two modes, and the split is not a UI preference — it is what keeps this
// form from fighting the conditional UPDATE that stops the shop overselling.
// See `src/lib/inventory-admin.ts`.
//
//   Received / removed   a DELTA. Composes with whatever sold meanwhile.
//   Counted              an absolute, sent with the number this row was showing
//                        when it rendered. If a sale landed in between, the
//                        server refuses and hands back reality.
//
// ⚠️ The reason box is required, and it is the part somebody will want to
// remove. Do not. The question asked three weeks later is never "what is the
// stock", it is "why is this eleven when the invoice says twelve", and
// `11 → 12` with no sentence answers nothing.

export function StockControl({
  variantId,
  sku,
  quantity,
}: {
  variantId: string;
  sku: string;
  quantity: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"delta" | "count">("delta");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = Number(amount);
    if (!Number.isInteger(n)) {
      setError("That needs to be a whole number.");
      return;
    }
    if (mode === "delta" && n === 0) {
      setError("Nothing to change.");
      return;
    }
    if (!reason.trim()) {
      setError("Say why, in a few words. Somebody will read this later.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "delta"
            ? { delta: n, reason: reason.trim() }
            : // ⚠️ `expected` is the number this component was rendered with,
              // not one read at submit time. Reading it fresh would defeat the
              // check entirely: it would always agree with itself.
              { quantity: n, expected: quantity, reason: reason.trim() },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        // A stale refusal means the page is showing an old number, so refresh
        // it even though the write failed — the person needs the new figure in
        // front of them before they try again.
        if (data.reason === "stale") router.refresh();
        return;
      }
      setOpen(false);
      setAmount("");
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
        className="text-xs text-neutral-500 underline hover:text-black"
      >
        Adjust
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border bg-neutral-50 p-3 text-left">
      <p className="text-xs text-neutral-500">
        {sku} — currently {quantity}
      </p>

      <div className="flex gap-3 text-xs">
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="radio"
            checked={mode === "delta"}
            onChange={() => setMode("delta")}
          />
          Received / removed
        </label>
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="radio"
            checked={mode === "count"}
            onChange={() => setMode("count")}
          />
          Counted on the shelf
        </label>
      </div>

      <input
        type="number"
        step="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={mode === "delta" ? "+20 or -2" : "how many are there"}
        className="w-full rounded border px-2 py-1 text-sm"
      />

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Why? e.g. supplier delivery, two damaged, stocktake"
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
