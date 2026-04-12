import Link from "next/link";
import { redirect } from "next/navigation";

import DeveloperConsoleActions from "./DeveloperConsoleActions";
import { serverApiFetch } from "../lib/api-fetch";

type Me = {
  id: string;
  email: string;
  is_admin: boolean;
};

type Developer = {
  id: string;
  public_id: string;
  name: string;
  owner_user_id: string | null;
  owner_email: string | null;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
};

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
};

type Scope = {
  id: string;
  api_key_id: string;
  match_type: "all" | "exact" | "prefix";
  resource_value: string | null;
  can_read: boolean;
  can_write: boolean;
  created_at: string;
};

export default async function DashboardPage() {
  const verifyRes = await serverApiFetch("/api/auth/verify");
  if (verifyRes.status === 401 || verifyRes.status === 403) {
    redirect("/login?next=/dashboard");
  }
  if (!verifyRes.ok) {
    throw new Error(`dashboard load failed: ${verifyRes.status}`);
  }
  const me: Me = await verifyRes.json();

  const developerRes = await serverApiFetch("/api/developer/me");
  if (!developerRes.ok) {
    throw new Error(`developer account load failed: ${developerRes.status}`);
  }
  const developer: Developer = await developerRes.json();

  const keysRes = await serverApiFetch("/api/developer/keys");
  if (!keysRes.ok) {
    throw new Error(`developer keys load failed: ${keysRes.status}`);
  }
  const keys: ApiKey[] = await keysRes.json();

  const keysWithScopes = await Promise.all(
    keys.map(async (key) => {
      const scopesRes = await serverApiFetch(`/api/developer/keys/${key.id}/scopes`);
      if (!scopesRes.ok) {
        throw new Error(`developer scopes load failed: ${scopesRes.status}`);
      }
      const scopes: Scope[] = await scopesRes.json();
      return { key, scopes };
    }),
  );

  return (
    <main style={{ maxWidth: 1120, margin: "48px auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Link href="/profile" style={topLink}>
          Profile
        </Link>
        {me.is_admin && (
          <Link href="/admin" style={topLink}>
            Admin
          </Link>
        )}
      </div>

      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Developer console</h1>
      <p style={{ marginBottom: 24, color: "var(--text-secondary)" }}>
        Manage the API keys and bucket scopes tied to your developer account.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section
          style={{
            border: "1px solid var(--border-primary)",
            borderRadius: 4,
            padding: 16,
            background: "var(--bg-secondary)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>{developer.name}</h2>
          <Row label="Email" value={me.email} />
          <Row label="Public ID" value={<code>{developer.public_id}</code>} />
          <Row
            label="Status"
            value={developer.is_frozen ? "frozen" : "active"}
          />
          <Row label="Key count" value={String(keys.length)} />
          <Row
            label="Created"
            value={new Date(developer.created_at).toLocaleString()}
          />
          <Row
            label="Updated"
            value={new Date(developer.updated_at).toLocaleString()}
          />
        </section>

        <DeveloperConsoleActions
          developerPublicId={developer.public_id}
          isFrozen={developer.is_frozen}
          keys={keysWithScopes}
        />
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 12,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}

const topLink: React.CSSProperties = {
  color: "var(--text-link)",
  textDecoration: "none",
  fontSize: 13,
  padding: "4px 10px",
  border: "1px solid var(--border-primary)",
  borderRadius: 4,
};
