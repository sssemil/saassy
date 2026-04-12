"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const next = url.searchParams.get("next");
    if (next) localStorage.setItem("post_login_next", next);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.code || `HTTP ${res.status}`);
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <main className="auth-shell">
      <section className="surface hero-surface auth-panel">
        <div className="page-heading">
          <span className="eyebrow">Shardd account</span>
          <h1>Sign in</h1>
          <p className="page-subtitle">
            Enter your email to receive a magic sign-in link.
          </p>
        </div>

        {status === "sent" ? (
          <div className="notice notice-success">
            <span className="notice-title">Check your inbox</span>
            <p className="notice-copy">
              We sent a sign-in link to <strong>{email}</strong>. It expires in
              15 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              className="button-primary button-block"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="small text-danger">Error: {error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
