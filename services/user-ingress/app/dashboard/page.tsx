import Link from "next/link";
import { redirect } from "next/navigation";

import { serverApiFetch } from "../lib/api-fetch";
import DeveloperConsoleActions from "./DeveloperConsoleActions";

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
    throw new Error(`developer access load failed: ${developerRes.status}`);
  }
  const developer: Developer = await developerRes.json();

  const keysRes = await serverApiFetch("/api/developer/keys");
  if (!keysRes.ok) {
    throw new Error(`developer keys load failed: ${keysRes.status}`);
  }
  const keys: ApiKey[] = await keysRes.json();

  const keysWithScopes = await Promise.all(
    keys.map(async (key) => {
      const scopesRes = await serverApiFetch(
        `/api/developer/keys/${key.id}/scopes`,
      );
      if (!scopesRes.ok) {
        throw new Error(`developer scopes load failed: ${scopesRes.status}`);
      }
      const scopes: Scope[] = await scopesRes.json();
      return { key, scopes };
    }),
  );

  const activeKeys = keysWithScopes.filter(({ key }) => {
    if (key.revoked_at) return false;
    if (!key.expires_at) return true;
    return new Date(key.expires_at).getTime() > Date.now();
  }).length;
  const scopeCount = keysWithScopes.reduce(
    (total, entry) => total + entry.scopes.length,
    0,
  );

  return (
    <main className="page-shell">
      <div className="stack-lg">
        <section className="surface hero-surface">
          <div className="page-header">
            <div className="page-heading">
              <span className="eyebrow">Developer access</span>
              <h1>Developer console</h1>
              <p className="page-subtitle">
                Every user gets a developer identity. Issue keys, manage scopes,
                and keep API access under your account.
              </p>
            </div>
            <div className="header-actions">
              <span className="badge badge-success">active</span>
            </div>
          </div>
          <div className="pill-nav">
            <Link href="/profile" className="pill-link">
              Profile
            </Link>
            {me.is_admin && (
              <Link href="/admin" className="pill-link">
                Admin panel
              </Link>
            )}
          </div>
        </section>

        <section className="stats-grid">
          <Stat label="API keys" value={keys.length.toLocaleString()} />
          <Stat label="Active keys" value={activeKeys.toLocaleString()} />
          <Stat label="Scopes" value={scopeCount.toLocaleString()} />
        </section>

        <div className="grid-sidebar">
          <section className="surface">
            <div className="section-header">
              <div className="stack">
                <h2 className="section-title">{me.email}</h2>
                <p className="section-copy">
                  Your personal developer identity and current API access
                  footprint.
                </p>
              </div>
            </div>
            <div className="meta-list">
              <Row label="Email" value={me.email} />
              <Row label="Developer ID" value={<code>{developer.public_id}</code>} />
              <Row label="Key count" value={String(keys.length)} />
              <Row
                label="Created"
                value={new Date(developer.created_at).toLocaleString()}
              />
              <Row
                label="Updated"
                value={new Date(developer.updated_at).toLocaleString()}
              />
            </div>
          </section>

          <DeveloperConsoleActions
            developerPublicId={developer.public_id}
            keys={keysWithScopes}
          />
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="meta-row">
      <div className="meta-label">{label}</div>
      <div className="meta-value">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
