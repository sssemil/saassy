import Link from "next/link";
import { notFound } from "next/navigation";

import { serverApiFetch } from "../../../lib/api-fetch";
import DeveloperAccessSection from "./DeveloperAccessSection";
import UserActions from "./UserActions";

type User = {
  id: string;
  email: string;
  language: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  is_admin: boolean;
  is_frozen: boolean;
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

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const userRes = await serverApiFetch(`/api/admin/users/${id}`);
  if (userRes.status === 404) notFound();
  if (!userRes.ok) throw new Error(`user load failed: ${userRes.status}`);
  const user: User = await userRes.json();

  const developerRes = await serverApiFetch(`/api/admin/users/${id}/developer`);
  if (!developerRes.ok) {
    throw new Error(`developer access load failed: ${developerRes.status}`);
  }
  const developer: Developer = await developerRes.json();

  const keysRes = await serverApiFetch(`/api/admin/users/${id}/developer/keys`);
  if (!keysRes.ok) throw new Error(`keys load failed: ${keysRes.status}`);
  const keys: ApiKey[] = await keysRes.json();

  const keysWithScopes = await Promise.all(
    keys.map(async (key) => {
      const scopesRes = await serverApiFetch(
        `/api/admin/users/${id}/developer/keys/${key.id}/scopes`,
      );
      if (!scopesRes.ok) {
        throw new Error(`scopes load failed: ${scopesRes.status}`);
      }
      const scopes: Scope[] = await scopesRes.json();
      return { key, scopes };
    }),
  );

  return (
    <div className="stack-lg">
      <div className="inline-links">
        <Link href="/admin/users" className="pill-link">
          Back to users
        </Link>
      </div>

      <section className="surface hero-surface">
        <div className="page-header">
          <div className="page-heading">
            <span className="eyebrow">User detail</span>
            <h1>{user.email}</h1>
            <p className="page-subtitle">
              Manage account state, impersonation, and developer API access from
              one view.
            </p>
          </div>
          <div className="header-actions">
            {user.is_admin && <span className="badge badge-primary">admin</span>}
            <span
              className={`badge ${
                user.is_frozen ? "badge-warning" : "badge-success"
              }`}
            >
              {user.is_frozen ? "frozen" : "active"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid-sidebar">
        <div className="stack-lg">
          <section className="surface">
            <div className="section-header">
              <div className="stack">
                <h2 className="section-title">Account summary</h2>
                <p className="section-copy">
                  Core user metadata and the attached developer identity.
                </p>
              </div>
            </div>
            <div className="meta-list">
              <Row label="ID" value={<code>{user.id}</code>} />
              <Row label="Email" value={user.email} />
              <Row label="Language" value={user.language} />
              <Row label="Admin" value={user.is_admin ? "yes" : "no"} />
              <Row label="Frozen" value={user.is_frozen ? "yes" : "no"} />
              <Row
                label="User created"
                value={new Date(user.created_at).toLocaleString()}
              />
              <Row
                label="User updated"
                value={new Date(user.updated_at).toLocaleString()}
              />
              <Row
                label="Last login"
                value={
                  user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString()
                    : "—"
                }
              />
              <Row label="Developer ID" value={<code>{developer.public_id}</code>} />
              <Row
                label="API access"
                value={user.is_frozen ? "frozen" : "active"}
              />
              <Row label="API keys" value={String(keys.length)} />
              <Row
                label="Developer created"
                value={new Date(developer.created_at).toLocaleString()}
              />
              <Row
                label="Developer updated"
                value={new Date(developer.updated_at).toLocaleString()}
              />
            </div>
          </section>

          <section className="surface">
            <UserActions
              userId={user.id}
              userEmail={user.email}
              isAdmin={user.is_admin}
              isFrozen={user.is_frozen}
            />
          </section>
        </div>

        <DeveloperAccessSection
          userId={user.id}
          developerPublicId={developer.public_id}
          isUserFrozen={user.is_frozen}
          keys={keysWithScopes}
        />
      </div>
    </div>
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
