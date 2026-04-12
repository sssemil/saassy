"use client";

import { useState } from "react";

export default function DeleteAccountButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    if (
      !confirm(
        "Permanently delete your account?\n\nYour user record, session, and audit history will be removed. This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.code || `HTTP ${res.status}`);
      }
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <button type="button" onClick={del} disabled={busy} className="button-danger">
        {busy ? "Deleting…" : "Delete my account"}
      </button>
      {error && <p className="small text-danger">Error: {error}</p>}
    </div>
  );
}
