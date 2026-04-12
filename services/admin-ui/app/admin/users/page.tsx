import Link from "next/link";

import { serverApiFetch } from "../../lib/api-fetch";

type User = {
  id: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
  is_admin: boolean;
  is_frozen: boolean;
};

type ListResponse = {
  users: User[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE_SIZE = 50;

export default async function UsersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  qs.set("limit", String(PAGE_SIZE));
  qs.set("offset", String(offset));

  const res = await serverApiFetch(`/api/admin/users?${qs.toString()}`);
  if (!res.ok) throw new Error(`users load failed: ${res.status}`);
  const data: ListResponse = await res.json();
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const prevQuery = new URLSearchParams({
    ...(q ? { q } : {}),
    page: String(page - 1),
  }).toString();
  const nextQuery = new URLSearchParams({
    ...(q ? { q } : {}),
    page: String(page + 1),
  }).toString();

  return (
    <div className="stack-lg">
      <section className="surface hero-surface">
        <div className="page-header">
          <div className="page-heading">
            <span className="eyebrow">People</span>
            <h1>Users</h1>
            <p className="page-subtitle">
              Search and inspect every user account that can access the
              dashboard.
            </p>
          </div>
          <div className="header-actions">
            <span className="badge badge-neutral">
              {data.total.toLocaleString()} total
            </span>
          </div>
        </div>

        <form method="get" className="search-form">
          <div className="field-grow">
            <label className="label" htmlFor="q">
              Search users
            </label>
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by email"
            />
          </div>
          <button type="submit" className="button-primary">
            Search
          </button>
          {q && (
            <Link href="/admin/users" className="pill-link">
              Clear
            </Link>
          )}
        </form>
      </section>

      <section className="surface table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Created</th>
                <th>Last login</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No users found.
                  </td>
                </tr>
              ) : (
                data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="link-inline">
                        {u.email}
                      </Link>
                    </td>
                    <td>{new Date(u.created_at).toLocaleString()}</td>
                    <td>
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <div className="action-row">
                        {u.is_admin && <Tag variant="primary">admin</Tag>}
                        {u.is_frozen ? (
                          <Tag variant="warning">frozen</Tag>
                        ) : !u.is_admin ? (
                          <Tag>active</Tag>
                        ) : null}
                      </div>
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
          {data.total.toLocaleString()} users · page {page} / {totalPages}
        </span>
        <span className="spacer" />
        {page > 1 && (
          <Link href={`?${prevQuery}`} className="pill-link">
            Prev
          </Link>
        )}
        {page < totalPages && (
          <Link href={`?${nextQuery}`} className="pill-link">
            Next
          </Link>
        )}
      </div>
    </div>
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
