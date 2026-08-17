"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Follows the login page's pattern — controlled state and a plain fetch —
// rather than introducing a form library for one screen.

const RULES = [
  "At least 12 characters",
  "An uppercase and a lowercase letter",
  "A digit",
  "A special character",
];

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Checked here purely to save a round trip; the server is what decides.
    if (newPassword !== confirmPassword) {
      setError("The two new passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        // The endpoint returns zod issues on a 400; show the first one, which
        // is the rule that was actually broken.
        setError(data.issues?.[0]?.message || data.error || "Could not change the password");
        return;
      }

      // The server reissues the token, so the session survives the change.
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {forced && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This account is still on its initial password. Choose a new one before
          carrying on.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-describedby="password-rules"
        />
        <ul
          id="password-rules"
          className="mt-2 space-y-1 text-xs text-neutral-500"
        >
          {RULES.map((rule) => (
            <li key={rule}>· {rule}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Repeat the new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
