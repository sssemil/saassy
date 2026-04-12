import { serverApiFetch } from "../lib/api-fetch";

type Stats = {
  total_users: number;
  users_last_7_days: number;
  users_last_30_days: number;
  frozen_users: number;
  admin_users: number;
};

export default async function AdminOverviewPage() {
  const res = await serverApiFetch("/api/admin/stats");
  if (!res.ok) throw new Error(`stats load failed: ${res.status}`);
  const s: Stats = await res.json();

  const cards: { label: string; value: number }[] = [
    { label: "Total users", value: s.total_users },
    { label: "New in last 7 days", value: s.users_last_7_days },
    { label: "New in last 30 days", value: s.users_last_30_days },
    { label: "Frozen", value: s.frozen_users },
    { label: "Admins", value: s.admin_users },
  ];

  return (
    <div className="stack-lg">
      <section className="surface hero-surface">
        <div className="page-heading">
          <span className="eyebrow">Operations</span>
          <h1>Overview</h1>
          <p className="page-subtitle">
            Monitor the current user base and account health across the
            dashboard.
          </p>
        </div>
      </section>

      <div className="stats-grid">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
