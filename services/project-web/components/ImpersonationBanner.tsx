"use client";

export default function ImpersonationBanner({ email }: { email: string }) {
  async function endImpersonation() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  return (
    <div
      style={{
        background: "var(--accent-orange)",
        color: "#000",
        padding: "8px 16px",
        textAlign: "center",
        fontSize: 13,
        fontFamily: "var(--font-mono)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <strong>Impersonating {email}</strong>
      <span style={{ opacity: 0.8 }}>
        You are signed in as another user. Actions are attributed to them.
      </span>
      <button
        onClick={endImpersonation}
        style={{
          background: "#000",
          color: "#fff",
          border: "none",
          padding: "4px 10px",
          borderRadius: 4,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        End impersonation
      </button>
    </div>
  );
}
