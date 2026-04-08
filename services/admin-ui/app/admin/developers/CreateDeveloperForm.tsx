"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateDeveloperForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Developer name is required");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/developers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.code || `HTTP ${res.status}`);
      }
      const developer = await res.json();
      setName("");
      router.push(`/admin/developers/${developer.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div style={{ minWidth: 280, flex: 1 }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New developer account name"
          disabled={busy}
        />
      </div>
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Creating…" : "Create developer"}
      </button>
      {error && (
        <p style={{ width: "100%", color: "var(--text-error)" }}>
          Error: {error}
        </p>
      )}
    </form>
  );
}
