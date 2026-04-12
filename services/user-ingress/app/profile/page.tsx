import Link from "next/link";
import { redirect } from "next/navigation";

import DeleteAccountButton from "./DeleteAccountButton";
import { serverApiFetch } from "../lib/api-fetch";

type Me = {
  id: string;
  email: string;
  is_admin: boolean;
};

export default async function ProfilePage() {
  const res = await serverApiFetch("/api/auth/verify");
  if (res.status === 401 || res.status === 403) {
    redirect("/login?next=/profile");
  }
  if (!res.ok) {
    throw new Error(`profile load failed: ${res.status}`);
  }
  const me: Me = await res.json();

  return (
    <main className="page-shell page-shell-narrow">
      <div className="stack-lg">
        <section className="surface hero-surface">
          <div className="page-header">
            <div className="page-heading">
              <span className="eyebrow">Account</span>
              <h1>Your profile</h1>
              <p className="page-subtitle">
                Manage your account and jump straight into your developer or
                admin tools.
              </p>
            </div>
            <div className="header-actions">
              <span
                className={`badge ${
                  me.is_admin ? "badge-primary" : "badge-neutral"
                }`}
              >
                {me.is_admin ? "admin" : "developer"}
              </span>
            </div>
          </div>
          <div className="pill-nav">
            <Link href="/dashboard" className="pill-link">
              Developer console
            </Link>
            {me.is_admin && (
              <Link href="/admin" className="pill-link">
                Admin panel
              </Link>
            )}
          </div>
        </section>

        <section className="surface">
          <div className="section-header">
            <div className="stack">
              <h2 className="section-title">Profile details</h2>
              <p className="section-copy">
                Your core user identity and access level.
              </p>
            </div>
          </div>
          <div className="meta-list">
            <Row label="Email" value={me.email} />
            <Row label="Role" value={me.is_admin ? "Admin" : "Developer"} />
            <Row label="User ID" value={<code>{me.id}</code>} />
          </div>
        </section>

        <section className="surface surface-danger">
          <div className="section-header">
            <div className="stack">
              <h2 className="section-title">Danger zone</h2>
              <p className="section-copy">
                Permanently delete your account. This cannot be undone.
              </p>
            </div>
          </div>
          <DeleteAccountButton />
        </section>
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
