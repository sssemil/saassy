"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getTokenFromSearch(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get("token");
}

export default function MagicPage() {
  const [status, setStatus] = useState("Processing magic link...");
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = getTokenFromSearch();
    if (!token) {
      setStatus("Missing authentication token");
      setError(true);
      return;
    }

    let redirectTimer: number | undefined;

    (async () => {
      try {
        const res = await fetch("/api/auth/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Invalid or expired token");
        }

        setStatus("Authentication successful. Redirecting...");
        setDone(true);

        const next = localStorage.getItem("post_login_next") || "/";
        localStorage.removeItem("post_login_next");
        redirectTimer = window.setTimeout(() => {
          window.location.href = next;
        }, 500);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Authentication failed");
        setError(true);
      }
    })();

    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, []);

  return (
    <main className="auth-shell">
      <section className="surface auth-panel">
        <div className="page-heading">
          <span className="eyebrow">Magic link</span>
          <h1>Authenticating</h1>
          <p className="page-subtitle">
            We are validating your sign-in link and restoring your session.
          </p>
        </div>

        {done ? (
          <div className="notice notice-success">
            <div className="loading-text">
              <span className="spinner" />
              <span>{status}</span>
            </div>
          </div>
        ) : error ? (
          <div className="notice notice-danger">
            <span className="notice-title">Authentication failed</span>
            <p className="notice-copy">{status}</p>
            <div className="inline-links">
              <Link href="/login" className="pill-link">
                Return to sign in
              </Link>
            </div>
          </div>
        ) : (
          <div className="notice notice-info">
            <div className="loading-text">
              <span className="spinner" />
              <span>{status}</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
