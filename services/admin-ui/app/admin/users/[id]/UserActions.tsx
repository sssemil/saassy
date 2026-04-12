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
  const description = isAdmin
    ? "This is another admin account, so freeze, impersonate, and delete stay disabled here."
    : "Freeze access, impersonate the session, or permanently remove the user.";

  return (
    <div className="stack">
      <div className="section-header">
        <div className="stack">
          <h2 className="section-title">Account actions</h2>
          <p className="section-copy">{description}</p>
        </div>
      </div>

      <div className="action-row">
        {isFrozen ? (
          <Btn
            onClick={unfreeze}
            busy={busy === "unfreeze"}
            busyLabel="Unfreezing…"
            disabled={disabled("unfreeze")}
          >
            Unfreeze
          </Btn>
        ) : (
          <Btn
            onClick={freeze}
            busy={busy === "freeze"}
            busyLabel="Freezing…"
            disabled={isAdmin || disabled("freeze")}
            title={isAdmin ? "Cannot freeze another admin" : undefined}
            variant="warning"
          >
            Freeze
          </Btn>
        )}
        <Btn
          onClick={impersonate}
          busy={busy === "impersonate"}
          busyLabel="Impersonating…"
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
          busyLabel="Deleting…"
          disabled={isAdmin || disabled("delete")}
          title={isAdmin ? "Cannot delete another admin" : undefined}
          variant="danger"
        >
          Delete
        </Btn>
      </div>

      {error && (
        <div className="notice notice-danger">
          <span className="notice-title">Action failed</span>
          <p className="notice-copy">{error}</p>
        </div>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  busy,
  busyLabel = "Working…",
  disabled,
  title,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  busyLabel?: string;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "secondary" | "warning" | "danger";
}) {
  const className =
    variant === "primary"
      ? "button-primary"
      : variant === "danger"
        ? "button-danger"
        : variant === "warning"
          ? "button-warning"
          : "button-secondary";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={className}
    >
      {busy ? busyLabel : children}
    </button>
  );
}
