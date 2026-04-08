import Link from "next/link";
import { serverApiFetch } from "../../lib/api-fetch";

type Entry = {
  id: string;
  admin_id: string | null;
  admin_email: string;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Resp = {
  entries: Entry[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE_SIZE = 100;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const res = await serverApiFetch(
    `/api/admin/audit?limit=${PAGE_SIZE}&offset=${offset}`,
  );
  if (!res.ok) throw new Error(`audit load failed: ${res.status}`);
  const data: Resp = await res.json();
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Audit log</h1>

      <div
        style={{
          border: "1px solid var(--border-primary)",
          borderRadius: 4,
          overflow: "hidden",
          background: "var(--bg-secondary)",
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr style={{ background: "var(--bg-tertiary)", textAlign: "left" }}>
              <th style={th}>When</th>
              <th style={th}>Admin</th>
              <th style={th}>Action</th>
              <th style={th}>Target</th>
              <th style={th}>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              data.entries.map((e) => (
                <tr
                  key={e.id}
                  style={{ borderTop: "1px solid var(--border-primary)" }}
                >
                  <td style={td}>{new Date(e.created_at).toLocaleString()}</td>
                  <td style={td}>{e.admin_email}</td>
                  <td style={td}>
                    <code>{e.action}</code>
                  </td>
                  <td style={td}>
                    {e.target_user_id ? (
                      <Link
                        href={`/admin/users/${e.target_user_id}`}
                        style={{
                          color: "var(--text-link)",
                          textDecoration: "none",
                        }}
                      >
                        {e.target_email || e.target_user_id}
                      </Link>
                    ) : (
                      e.target_email || "—"
                    )}
                  </td>
                  <td style={td}>
                    <code style={{ color: "var(--text-muted)" }}>
                      {Object.keys(e.metadata).length > 0
                        ? JSON.stringify(e.metadata)
                        : "—"}
                    </code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        <span>
          {data.total.toLocaleString()} entries · page {page} / {totalPages}
        </span>
        <span style={{ flex: 1 }} />
        {page > 1 && (
          <Link href={`?page=${page - 1}`} style={pageLink}>
            ← Prev
          </Link>
        )}
        {page < totalPages && (
          <Link href={`?page=${page + 1}`} style={pageLink}>
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
};
const td: React.CSSProperties = { padding: "8px 12px", verticalAlign: "top" };
const pageLink: React.CSSProperties = {
  color: "var(--text-link)",
  textDecoration: "none",
  padding: "4px 10px",
  border: "1px solid var(--border-primary)",
  borderRadius: 4,
};
