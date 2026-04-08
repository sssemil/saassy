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

export default function DeveloperActions({
  developerId,
  developerPublicId,
  isFrozen,
  keys,
}: {
  developerId: string;
  developerPublicId: string;
  isFrozen: boolean;
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

  const toggleFrozen = () =>
    runAction("freeze", async () => {
      await call(
        `/api/admin/developers/${developerId}/${isFrozen ? "unfreeze" : "freeze"}`,
        "POST",
      );
      router.refresh();
    });

  const createKey = () =>
    runAction("create-key", async () => {
      if (!newKeyName.trim()) {
        throw new Error("API key name is required");
      }
      const res = await call(
        `/api/admin/developers/${developerId}/keys`,
        "POST",
        {
          name: newKeyName.trim(),
        },
      );
      const issued = await res.json();
      setNewKeyName("");
      window.prompt(
        `Copy the new API key for ${developerPublicId}. It will not be shown again.`,
        issued.raw_key,
      );
      router.refresh();
    });

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={card}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Developer actions</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn
            onClick={toggleFrozen}
            busy={busy === "freeze"}
            color={isFrozen ? "var(--accent-green)" : "var(--accent-orange)"}
          >
            {isFrozen ? "Unfreeze developer" : "Freeze developer"}
          </Btn>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Issue API key</h2>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ minWidth: 280, flex: 1 }}>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name, e.g. dev sdk"
              disabled={busy !== null}
            />
          </div>
          <Btn onClick={createKey} busy={busy === "create-key"}>
            Create key
          </Btn>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Keys and scopes</h2>
        {keys.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No API keys issued yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {keys.map((entry) => (
              <KeyCard
                key={entry.key.id}
                developerId={developerId}
                developerPublicId={developerPublicId}
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

      {error && <p style={{ color: "var(--text-error)" }}>Error: {error}</p>}
    </div>
  );
}

function KeyCard({
  developerId,
  developerPublicId,
  entry,
  busy,
  onAction,
  onCall,
  onRefresh,
}: {
  developerId: string;
  developerPublicId: string;
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
    )
      return "expired";
    return "active";
  }, [entry.key.expires_at, entry.key.revoked_at]);

  const revoke = () =>
    onAction(`revoke-${entry.key.id}`, async () => {
      if (!confirm(`Revoke key ${entry.key.name}?`)) return;
      await onCall(`/api/admin/keys/${entry.key.id}/revoke`, "POST");
      onRefresh();
    });

  const rotate = () =>
    onAction(`rotate-${entry.key.id}`, async () => {
      const res = await onCall(
        `/api/admin/keys/${entry.key.id}/rotate`,
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
      await onCall(`/api/admin/keys/${entry.key.id}/scopes`, "POST", {
        match_type: matchType,
        bucket: matchType === "all" ? null : bucket.trim(),
        can_read: canRead,
        can_write: canWrite,
      });
      setBucket("");
      setCanRead(true);
      setCanWrite(false);
      setMatchType("all");
      onRefresh();
    });

  const deleteScope = (scopeId: string) =>
    onAction(`delete-scope-${scopeId}`, async () => {
      if (!confirm("Delete this scope?")) return;
      await onCall(`/api/admin/scopes/${scopeId}`, "DELETE");
      onRefresh();
    });

  return (
    <div
      style={{
        border: "1px solid var(--border-primary)",
        borderRadius: 4,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <strong>{entry.key.name}</strong>
            <Tag
              color={
                status === "active"
                  ? "var(--accent-green)"
                  : "var(--accent-orange)"
              }
            >
              {status}
            </Tag>
            <code>{entry.key.key_prefix}</code>
          </div>
          <p
            style={{
              marginTop: 6,
              marginBottom: 0,
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            Last used:{" "}
            {entry.key.last_used_at
              ? new Date(entry.key.last_used_at).toLocaleString()
              : "never"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn
            onClick={rotate}
            busy={busy === `rotate-${entry.key.id}`}
            disabled={status !== "active"}
          >
            Rotate
          </Btn>
          <Btn
            onClick={revoke}
            busy={busy === `revoke-${entry.key.id}`}
            disabled={status !== "active"}
            color="var(--accent-red)"
          >
            Revoke
          </Btn>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Scopes</h3>
        {entry.scopes.length === 0 ? (
          <p style={{ color: "var(--text-muted)", marginBottom: 12 }}>
            No scopes attached.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {entry.scopes.map((scope) => (
              <div
                key={scope.id}
                style={{
                  border: "1px solid var(--border-primary)",
                  borderRadius: 4,
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <Tag color="var(--accent-blue)">{scope.match_type}</Tag>
                    <code>{scope.resource_value || "*"}</code>
                  </div>
                  <p
                    style={{
                      marginTop: 6,
                      marginBottom: 0,
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {scope.can_read ? "read" : "no-read"} ·{" "}
                    {scope.can_write ? "write" : "no-write"}
                  </p>
                </div>
                <Btn
                  onClick={() => deleteScope(scope.id)}
                  busy={busy === `delete-scope-${scope.id}`}
                  color="var(--accent-red)"
                >
                  Delete scope
                </Btn>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "160px 1fr",
              alignItems: "center",
            }}
          >
            <select
              value={matchType}
              onChange={(e) =>
                setMatchType(e.target.value as "all" | "exact" | "prefix")
              }
            >
              <option value="all">all buckets</option>
              <option value="exact">exact bucket</option>
              <option value="prefix">bucket prefix</option>
            </select>
            <input
              type="text"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              disabled={matchType === "all"}
              placeholder={matchType === "prefix" ? "orders/" : "orders"}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label style={checkboxLabel}>
              <input
                type="checkbox"
                checked={canRead}
                onChange={(e) => setCanRead(e.target.checked)}
              />
              Read
            </label>
            <label style={checkboxLabel}>
              <input
                type="checkbox"
                checked={canWrite}
                onChange={(e) => setCanWrite(e.target.checked)}
              />
              Write
            </label>
            <Btn
              onClick={createScope}
              busy={busy === `create-scope-${entry.key.id}`}
            >
              Add scope
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  busy,
  disabled,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
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

function Tag({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 3,
        background: color,
        color: "#000",
        fontSize: 11,
      }}
    >
      {children}
    </span>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--border-primary)",
  borderRadius: 4,
  padding: 16,
  background: "var(--bg-secondary)",
};

const checkboxLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 0,
};
