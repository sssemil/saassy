"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Scope = {
  id: string;
  api_key_id: string;
  match_type: "all" | "exact" | "prefix";
  resource_value: string | null;
  can_read: boolean;
  can_write: boolean;
};

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  revoked_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
};

type KeyWithScopes = {
  key: ApiKey;
  scopes: Scope[];
};

export default function DeveloperAccessSection({
  userId,
  developerPublicId,
  isUserFrozen,
  keys,
}: {
  userId: string;
  developerPublicId: string;
  isUserFrozen: boolean;
  keys: KeyWithScopes[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");

  async function call(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<Response> {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.message || payload.code || `HTTP ${res.status}`);
    }
    return res;
  }

  async function runAction(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  }

  const createKey = () =>
    runAction("create-key", async () => {
      if (!newKeyName.trim()) {
        throw new Error("API key name is required");
      }
      const res = await call(`/api/admin/users/${userId}/developer/keys`, "POST", {
        name: newKeyName.trim(),
      });
      const issued = await res.json();
      setNewKeyName("");
      window.prompt(
        `Copy the new API key for ${developerPublicId}. It will not be shown again.`,
        issued.raw_key,
      );
      router.refresh();
    });

  return (
    <div className="stack-lg">
      {isUserFrozen && (
        <div className="notice notice-warning">
          <span className="notice-title">User frozen</span>
          <p className="notice-copy">
            This user is frozen, so their API keys no longer authorize traffic.
            You can still revoke existing keys or delete scopes, but issuing or
            rotating keys stays disabled until the user is unfrozen.
          </p>
        </div>
      )}

      <section className="surface">
        <div className="section-header">
          <div className="stack">
            <h2 className="section-title">Issue API key</h2>
            <p className="section-copy">
              Create a new credential on behalf of this user.
            </p>
          </div>
        </div>
        <div className="search-form">
          <div className="field-grow">
            <label className="label" htmlFor="admin-new-key-name">
              Key name
            </label>
            <input
              id="admin-new-key-name"
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name, e.g. production worker"
              disabled={busy !== null || isUserFrozen}
            />
          </div>
          <Btn
            onClick={createKey}
            busy={busy === "create-key"}
            busyLabel="Creating…"
            disabled={isUserFrozen}
            variant="primary"
          >
            Create key
          </Btn>
        </div>
      </section>

      <section className="surface">
        <div className="section-header">
          <div className="stack">
            <h2 className="section-title">Keys and scopes</h2>
            <p className="section-copy">
              Review issued credentials, rotate active keys, and keep scope
              grants tidy.
            </p>
          </div>
        </div>
        {keys.length === 0 ? (
          <div className="empty-state">No API keys issued yet.</div>
        ) : (
          <div className="stack">
            {keys.map((entry) => (
              <KeyCard
                key={entry.key.id}
                userId={userId}
                developerPublicId={developerPublicId}
                isUserFrozen={isUserFrozen}
                entry={entry}
                busy={busy}
                onAction={runAction}
                onCall={call}
                onRefresh={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="notice notice-danger">
          <span className="notice-title">Action failed</span>
          <p className="notice-copy">{error}</p>
        </div>
      )}
    </div>
  );
}

function KeyCard({
  userId,
  developerPublicId,
  isUserFrozen,
  entry,
  busy,
  onAction,
  onCall,
  onRefresh,
}: {
  userId: string;
  developerPublicId: string;
  isUserFrozen: boolean;
  entry: KeyWithScopes;
  busy: string | null;
  onAction: (name: string, fn: () => Promise<void>) => Promise<void>;
  onCall: (path: string, method: string, body?: unknown) => Promise<Response>;
  onRefresh: () => void;
}) {
  const [matchType, setMatchType] = useState<"all" | "exact" | "prefix">("all");
  const [bucket, setBucket] = useState("");
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);

  const status = useMemo(() => {
    if (entry.key.revoked_at) return "revoked";
    if (
      entry.key.expires_at &&
      new Date(entry.key.expires_at).getTime() < Date.now()
    ) {
      return "expired";
    }
    return "active";
  }, [entry.key.expires_at, entry.key.revoked_at]);

  const revoke = () =>
    onAction(`revoke-${entry.key.id}`, async () => {
      if (!confirm(`Revoke key ${entry.key.name}?`)) return;
      await onCall(
        `/api/admin/users/${userId}/developer/keys/${entry.key.id}/revoke`,
        "POST",
      );
      onRefresh();
    });

  const rotate = () =>
    onAction(`rotate-${entry.key.id}`, async () => {
      const res = await onCall(
        `/api/admin/users/${userId}/developer/keys/${entry.key.id}/rotate`,
        "POST",
      );
      const issued = await res.json();
      window.prompt(
        `Copy the rotated API key for ${developerPublicId}. It will not be shown again.`,
        issued.raw_key,
      );
      onRefresh();
    });

  const createScope = () =>
    onAction(`create-scope-${entry.key.id}`, async () => {
      if (matchType !== "all" && !bucket.trim()) {
        throw new Error("Bucket is required for exact or prefix scopes");
      }
      await onCall(
        `/api/admin/users/${userId}/developer/keys/${entry.key.id}/scopes`,
        "POST",
        {
          match_type: matchType,
          bucket: matchType === "all" ? null : bucket.trim(),
          can_read: canRead,
          can_write: canWrite,
        },
      );
      setBucket("");
      setCanRead(true);
      setCanWrite(false);
      setMatchType("all");
      onRefresh();
    });

  const deleteScope = (scopeId: string) =>
    onAction(`delete-scope-${scopeId}`, async () => {
      if (!confirm("Delete this scope?")) return;
      await onCall(`/api/admin/users/${userId}/developer/scopes/${scopeId}`, "DELETE");
      onRefresh();
    });

  const issueDisabled = isUserFrozen || status !== "active";

  return (
    <article className="panel stack">
      <div className="split-row">
        <div className="stack">
          <div className="action-row">
            <strong>{entry.key.name}</strong>
            <Tag variant={status === "active" ? "success" : "warning"}>
              {status}
            </Tag>
            <code>{entry.key.key_prefix}</code>
          </div>
          <p className="small muted">
            Last used:{" "}
            {entry.key.last_used_at
              ? new Date(entry.key.last_used_at).toLocaleString()
              : "never"}
          </p>
        </div>
        <div className="action-row">
          <Btn
            onClick={rotate}
            busy={busy === `rotate-${entry.key.id}`}
            busyLabel="Rotating…"
            disabled={issueDisabled}
          >
            Rotate
          </Btn>
          <Btn
            onClick={revoke}
            busy={busy === `revoke-${entry.key.id}`}
            busyLabel="Revoking…"
            disabled={status !== "active"}
            variant="danger"
          >
            Revoke
          </Btn>
        </div>
      </div>

      <div className="divider" />

      <div className="stack">
        <div className="stack">
          <h3 className="section-title">Scopes</h3>
          {entry.scopes.length === 0 ? (
            <div className="empty-state">No scopes attached.</div>
          ) : (
            <div className="stack">
              {entry.scopes.map((scope) => (
                <div key={scope.id} className="panel">
                  <div className="split-row">
                    <div className="stack">
                      <div className="action-row">
                        <Tag variant="primary">{scope.match_type}</Tag>
                        <code>{scope.resource_value || "*"}</code>
                      </div>
                      <p className="small muted">
                        {scope.can_read ? "read" : "no-read"} ·{" "}
                        {scope.can_write ? "write" : "no-write"}
                      </p>
                    </div>
                    <Btn
                      onClick={() => deleteScope(scope.id)}
                      busy={busy === `delete-scope-${scope.id}`}
                      busyLabel="Deleting…"
                      variant="danger"
                    >
                      Delete scope
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="form-grid">
            <div>
              <label className="label" htmlFor={`admin-match-type-${entry.key.id}`}>
                Match
              </label>
              <select
                id={`admin-match-type-${entry.key.id}`}
                value={matchType}
                onChange={(e) =>
                  setMatchType(e.target.value as "all" | "exact" | "prefix")
                }
                disabled={isUserFrozen}
              >
                <option value="all">all buckets</option>
                <option value="exact">exact bucket</option>
                <option value="prefix">bucket prefix</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`admin-bucket-${entry.key.id}`}>
                Bucket
              </label>
              <input
                id={`admin-bucket-${entry.key.id}`}
                type="text"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                disabled={matchType === "all" || isUserFrozen}
                placeholder={matchType === "prefix" ? "orders/" : "orders"}
              />
            </div>
          </div>

          <div className="checkbox-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={canRead}
                onChange={(e) => setCanRead(e.target.checked)}
                disabled={isUserFrozen}
              />
              Read
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={canWrite}
                onChange={(e) => setCanWrite(e.target.checked)}
                disabled={isUserFrozen}
              />
              Write
            </label>
            <Btn
              onClick={createScope}
              busy={busy === `create-scope-${entry.key.id}`}
              busyLabel="Adding…"
              disabled={issueDisabled}
              variant="primary"
            >
              Add scope
            </Btn>
          </div>
        </div>
      </div>
    </article>
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

function Tag({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning" | "danger" | "neutral";
}) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
