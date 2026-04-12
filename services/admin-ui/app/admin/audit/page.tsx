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
    <div className="stack-lg">
      <section className="surface hero-surface">
        <div className="page-header">
          <div className="page-heading">
            <span className="eyebrow">Governance</span>
            <h1>Audit log</h1>
            <p className="page-subtitle">
              Review privileged actions taken by admins across user and
              developer access controls.
            </p>
          </div>
          <div className="header-actions">
            <span className="badge badge-neutral">
              {data.total.toLocaleString()} entries
            </span>
          </div>
        </div>
      </section>

      <section className="surface table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.created_at).toLocaleString()}</td>
                    <td>{entry.admin_email}</td>
                    <td>
                      <code>{entry.action}</code>
                    </td>
                    <td>
                      {entry.target_user_id ? (
                        <Link
                          href={`/admin/users/${entry.target_user_id}`}
                          className="link-inline"
                        >
                          {entry.target_email || entry.target_user_id}
                        </Link>
                      ) : (
                        entry.target_email || "—"
                      )}
                    </td>
                    <td>
                      <code className="code-block-inline">
                        {Object.keys(entry.metadata).length > 0
                          ? JSON.stringify(entry.metadata)
                          : "—"}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pagination">
        <span>
          {data.total.toLocaleString()} entries · page {page} / {totalPages}
        </span>
        <span className="spacer" />
        {page > 1 && (
          <Link href={`?page=${page - 1}`} className="pill-link">
            Prev
          </Link>
        )}
        {page < totalPages && (
          <Link href={`?page=${page + 1}`} className="pill-link">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
