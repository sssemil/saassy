import Link from "next/link";
import DeveloperActions from "./DeveloperActions";
import { serverApiFetch } from "../../../lib/api-fetch";

type Developer = {
  id: string;
  public_id: string;
  name: string;
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

export default async function DeveloperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const developerRes = await serverApiFetch(`/api/admin/developers/${id}`);
  if (!developerRes.ok)
    throw new Error(`developer load failed: ${developerRes.status}`);
  const developer: Developer = await developerRes.json();

  const keysRes = await serverApiFetch(`/api/admin/developers/${id}/keys`);
  if (!keysRes.ok) throw new Error(`keys load failed: ${keysRes.status}`);
  const keys: ApiKey[] = await keysRes.json();

  const keysWithScopes = await Promise.all(
    keys.map(async (key) => {
      const scopesRes = await serverApiFetch(
        `/api/admin/keys/${key.id}/scopes`,
      );
      if (!scopesRes.ok)
        throw new Error(`scopes load failed: ${scopesRes.status}`);
      const scopes: Scope[] = await scopesRes.json();
      return { key, scopes };
    }),
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/admin/developers"
          style={{
            color: "var(--text-link)",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Back to developers
        </Link>
      </div>

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
          <h1 style={{ fontSize: 20, marginBottom: 16 }}>{developer.name}</h1>
          <Row label="Public ID" value={<code>{developer.public_id}</code>} />
          <Row
            label="Status"
            value={developer.is_frozen ? "frozen" : "active"}
          />
          <Row
            label="Created"
            value={new Date(developer.created_at).toLocaleString()}
          />
          <Row
            label="Updated"
            value={new Date(developer.updated_at).toLocaleString()}
          />
          <Row label="Key count" value={String(keys.length)} />
        </section>

        <DeveloperActions
          developerId={developer.id}
          developerPublicId={developer.public_id}
          isFrozen={developer.is_frozen}
          keys={keysWithScopes}
        />
      </div>
    </div>
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
