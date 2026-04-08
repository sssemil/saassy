"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserActions({
  userId,
  userEmail,
  isAdmin,
  isFrozen,
}: {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  isFrozen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, method: string): Promise<Response> {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.code || `HTTP ${res.status}`);
    }
    return res;
  }

  async function runAction(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }

  const freeze = () =>
    runAction("freeze", async () => {
      await call(`/api/admin/users/${userId}/freeze`, "POST");
      router.refresh();
    });

  const unfreeze = () =>
    runAction("unfreeze", async () => {
      await call(`/api/admin/users/${userId}/unfreeze`, "POST");
      router.refresh();
    });

  const impersonate = () =>
    runAction("impersonate", async () => {
      if (
        !confirm(
          `Impersonate ${userEmail}?\n\nYour admin session will be replaced with theirs. To regain admin access, sign out and sign back in.`,
        )
      )
        return;
      await call(`/api/admin/users/${userId}/impersonate`, "POST");
      window.location.href = "/";
    });

  const del = () =>
    runAction("delete", async () => {
      if (
        !confirm(
          `Delete ${userEmail}?\n\nThis removes all their data. This cannot be undone.`,
        )
      )
        return;
      await call(`/api/admin/users/${userId}`, "DELETE");
      router.push("/admin/users");
    });

  const disabled = (name: string) => busy !== null && busy !== name;

  return (
    <div>
      <h2
        style={{
          fontSize: 15,
          marginBottom: 12,
          color: "var(--text-secondary)",
        }}
      >
        Actions
      </h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isFrozen ? (
          <Btn
            onClick={unfreeze}
            busy={busy === "unfreeze"}
            disabled={disabled("unfreeze")}
          >
            Unfreeze
          </Btn>
        ) : (
          <Btn
            onClick={freeze}
            busy={busy === "freeze"}
            disabled={isAdmin || disabled("freeze")}
            title={isAdmin ? "Cannot freeze another admin" : undefined}
            color="var(--accent-orange)"
          >
            Freeze
          </Btn>
        )}
        <Btn
          onClick={impersonate}
          busy={busy === "impersonate"}
          disabled={isAdmin || isFrozen || disabled("impersonate")}
          title={
            isAdmin
              ? "Cannot impersonate another admin"
              : isFrozen
                ? "Cannot impersonate a frozen user"
                : undefined
          }
        >
          Impersonate
        </Btn>
        <Btn
          onClick={del}
          busy={busy === "delete"}
          disabled={isAdmin || disabled("delete")}
          title={isAdmin ? "Cannot delete another admin" : undefined}
          color="var(--accent-red)"
        >
          Delete
        </Btn>
      </div>
      {error && (
        <p style={{ marginTop: 12, color: "var(--text-error)" }}>
          Error: {error}
        </p>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  busy,
  disabled,
  title,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  title?: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      style={{
        padding: "8px 14px",
        background: color || "var(--bg-tertiary)",
        color: color ? "#000" : "var(--text-primary)",
        border: "1px solid var(--border-primary)",
        borderRadius: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        cursor: disabled ? "not-allowed" : busy ? "wait" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}
