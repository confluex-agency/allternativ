"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Creating a code, and switching one off. The rules are in
// `src/lib/promotions-admin.ts`; this shows the one thing Stripe's own
// dashboard cannot: where the code would be refused, BEFORE it exists.

type Impact = {
  market: string;
  refused: number;
  total: number;
  worst: { netCents: number; country: string; pairs: number } | null;
};

const MARKET_LABELS: Record<string, string> = {
  EU: "Europe",
  GB: "UK",
  US: "US",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
};

export function CreatePromotion() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("15");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expires, setExpires] = useState("");
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [impact, setImpact] = useState<Impact[] | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  const pct = Number(percent);
  const pctValid = Number.isInteger(pct) && pct >= 1 && pct <= 90;

  // Recomputed as the percentage is typed, debounced so a person typing "25"
  // does not ask the server about "2" first.
  useEffect(() => {
    if (!pctValid) return;
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/promotions/codes/impact?percent=${pct}`);
      if (res.ok) setImpact((await res.json()).markets);
    }, 300);
    return () => clearTimeout(handle);
  }, [pct, pctValid]);

  const refusedSomewhere = impact?.some((m) => m.refused > 0) ?? false;

  async function submit() {
    setError("");
    setDone("");
    if (!pctValid) {
      setError("A whole percentage between 1 and 90.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/promotions/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          percentOff: pct,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
          // The end of that day, in the admin's own time zone.
          expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
          firstOrderOnly,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setDone(`${data.code} is live. Customers type it in the bag.`);
      setCode("");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">New code</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-neutral-500">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH15"
            maxLength={32}
            className="mt-1 w-full rounded border px-2 py-1.5 font-mono"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-500">Percent off the pairs</span>
          <input
            inputMode="numeric"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-500">Uses in total (optional)</span>
          <input
            inputMode="numeric"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value.replace(/\D/g, ""))}
            placeholder="no limit"
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-500">Last day (optional)</span>
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={firstOrderOnly}
          onChange={(e) => setFirstOrderOnly(e.target.checked)}
        />
        Only for a customer&apos;s first order
      </label>

      {impact && pctValid && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            refusedSomewhere ? "bg-amber-50 text-amber-900" : "bg-neutral-50 text-neutral-700"
          }`}
        >
          {refusedSomewhere ? (
            <>
              <p className="font-medium">
                At {pct}%, some baskets would sell below cost, and the bag will refuse the code on
                them (&quot;not valid for this order&quot;):
              </p>
              <ul className="mt-2 space-y-1">
                {impact
                  .filter((m) => m.refused > 0)
                  .map((m) => (
                    <li key={m.market}>
                      {MARKET_LABELS[m.market] ?? m.market}: {m.refused} of {m.total} baskets
                      {m.worst && ` (worst: ${m.worst.pairs} pairs to ${m.worst.country})`}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p>At {pct}%, every basket in every market still covers its costs.</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {done && <p className="mt-3 text-sm text-green-700">{done}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !code}
        className="mt-4 rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Creating..." : "Create code"}
      </button>
    </div>
  );
}

export function PromotionToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/promotions/codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || "Something went wrong");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="text-xs text-neutral-500 underline hover:text-black disabled:opacity-50"
      >
        {active ? "Switch off" : "Switch on"}
      </button>
      {error && <span className="block text-xs text-red-700">{error}</span>}
    </>
  );
}
