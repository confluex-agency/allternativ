"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// The staff list, and the form that adds to it.
//
// ⚠️ Nothing here is a security control — the OWNER check lives on the page and
// on both API routes, and this component would happily render for anybody who
// got it into their browser. What it is for is making the consequences legible
// at the moment somebody picks, because the mistake this screen invites is not
// clicking the wrong button, it is not knowing what the button means.

const ROLES = [
  {
    value: "OWNER",
    label: "Owner",
    detail: "Everything, including inviting people and changing these roles.",
  },
  {
    value: "ECOMMERCE_ADMIN",
    label: "Ecommerce admin",
    detail: "Products, prices, stock, promotions, orders and customers.",
  },
  {
    value: "CONTENT_ADMIN",
    label: "Content admin",
    detail: "Images, copy, collections. No orders, no customers, no money.",
  },
  {
    value: "ANALYTICS_VIEWER",
    label: "Analytics viewer",
    detail: "Dashboards and reports only. Cannot change anything.",
  },
] as const;

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  hasAccepted: boolean;
  inviteEmailStatus: string;
  invitedByEmail: string | null;
}

export function AdminUsersPanel({
  users,
  currentEmail,
}: {
  users: AdminUserRow[];
  currentEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("ANALYTICS_VIEWER");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setNotice(
        `Invitation queued for ${email}. It goes out with the next sweep, ` +
          `within fifteen minutes, and the link lasts a day.`,
      );
      setEmail("");
      setName("");
      setRole("ANALYTICS_VIEWER");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resend(id: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin-users/${id}/resend`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      // ⚠️ Which link went out is decided by the ROW, not by this screen — an
      // account that never accepted gets a fresh invitation, one that already
      // has a password gets a reset. Reported back rather than assumed, so the
      // OWNER can tell the person what to expect in their inbox.
      setNotice(
        data.sent === "reset"
          ? "A password reset link is queued. It goes out with the next sweep, within fifteen minutes."
          : "A fresh invitation is queued. It goes out with the next sweep, within fifteen minutes.",
      );
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin-users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.email === currentEmail;
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-neutral-500">{u.email}</div>
                    {u.invitedByEmail && (
                      <div className="mt-0.5 text-xs text-neutral-400">
                        invited by {u.invitedByEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={busy || !u.isActive}
                      onChange={(e) => patch(u.id, { role: e.target.value })}
                      className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {/* Said beside the control rather than in a legend
                        somewhere, because the question "what does this one
                        actually let them do" is asked at the moment of
                        choosing and nowhere else. */}
                    <div className="mt-1 max-w-xs text-xs text-neutral-400">
                      {ROLES.find((r) => r.value === u.role)?.detail}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {!u.isActive ? (
                      <span className="text-neutral-400">Deactivated</span>
                    ) : u.hasAccepted ? (
                      <span className="text-green-700">Active</span>
                    ) : (
                      <span className="text-amber-600">
                        Invited, not accepted
                        <br />
                        <span className="text-neutral-400">
                          mail: {u.inviteEmailStatus.toLowerCase()}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* ⚠️ Deactivating yourself is not offered. The API refuses
                        to strand the last owner, but a button that is usually
                        a mistake should not be sitting there at all. */}
                    <div className="flex flex-col items-end gap-1">
                      {/* Offered for anybody active, including yourself: the
                          self-service form on the sign-in page covers the case
                          where you cannot get in, and this covers the far more
                          common one where somebody asks you. */}
                      {u.isActive && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resend(u.id)}
                          className="text-xs underline disabled:opacity-50"
                        >
                          {u.hasAccepted ? "Send reset link" : "Resend invite"}
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            patch(u.id, { isActive: !u.isActive })
                          }
                          className="text-xs underline disabled:opacity-50"
                        >
                          {u.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                      {isSelf && (
                        <span className="text-xs text-neutral-400">you</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      <form onSubmit={invite} className="max-w-lg space-y-4 rounded-lg border bg-white p-5">
        <h2 className="text-sm font-semibold">Invite somebody</h2>
        <p className="text-xs text-neutral-500">
          They get an email with a link to choose their own password. Nobody
          sends a password to anybody.
        </p>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs uppercase tracking-wide text-neutral-500">
            Access
          </legend>
          {ROLES.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="mt-1"
              />
              <span className="text-sm">
                {r.label}
                <span className="block text-xs text-neutral-500">
                  {r.detail}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Sending..." : "Send invitation"}
        </button>
      </form>
    </div>
  );
}
