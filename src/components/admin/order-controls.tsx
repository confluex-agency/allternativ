"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MANUAL_STATUSES, type ManualStatus } from "@/lib/order-status";

// The two things a person may do to an order, kept visibly apart because they
// are not the same kind of act.
//
// ⚠️ The dropdown cannot reach SHIPPED, and that is the design rather than an
// omission. "Shipped" is what a tracking number means: both doors from the
// supplier write the status and the number together, and the dispatch email is
// only sent when both are there. A status picker that could say SHIPPED on its
// own would produce an order marked shipped with nothing to track, which the
// sweep skips for ever while the buyer hears nothing at all.
//
// So dispatching is its own form, and the number is not optional.

const LABELS: Record<ManualStatus, string> = {
  PROCESSING: "Processing — seen, being prepared",
  CANCELLED: "Cancelled — will not be fulfilled",
};

export function OrderControls({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

  const gone = status === "SHIPPED" || status === "DELIVERED";
  const dispatchable = status === "PAID" || status === "PROCESSING";

  async function send(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That did not work");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function dispatch(e: FormEvent) {
    e.preventDefault();
    const ok = await send({
      trackingNumber,
      ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
    });
    if (ok) {
      setTrackingNumber("");
      setCarrier("");
    }
  }

  if (gone) {
    return (
      <div className="rounded-lg border bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Status
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          This order has shipped. Its status belongs to the courier now, and the
          buyer has been told — so it is not changed from here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Status
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {MANUAL_STATUSES.map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              disabled={busy || status === s}
              onClick={() => send({ status: s })}
            >
              {LABELS[s]}
            </Button>
          ))}
        </div>
        {/* Said out loud because the opposite is the natural assumption. */}
        <p className="mt-3 text-xs text-neutral-500">
          Cancelling records the decision only. It does not refund the card —
          that is done in Stripe — and it does not put the pairs back on the
          shelf.
        </p>
      </div>

      {dispatchable && (
        <form onSubmit={dispatch} className="border-t pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Mark as dispatched
          </h2>
          <p className="mt-2 text-xs text-neutral-500">
            Only for a parcel sent outside Dianxiaomi. When the supplier ships
            it, the tracking number arrives on its own and this order moves
            itself.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tracking">Tracking number</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. LP00123456789CN"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carrier">Carrier (optional)</Label>
              <Input
                id="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. Correos"
              />
            </div>
          </div>
          {/* ⚠️ This is the sentence that stops somebody typing a placeholder
              into the field to "just mark it shipped". */}
          <p className="mt-3 text-xs text-neutral-500">
            The number is required: saving it sends the buyer their dispatch
            email, and an email with nothing to track in it is worse than none.
          </p>
          <Button
            type="submit"
            size="sm"
            className="mt-4"
            disabled={busy || !trackingNumber.trim()}
          >
            {busy ? "Saving…" : "Mark dispatched and notify the buyer"}
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
