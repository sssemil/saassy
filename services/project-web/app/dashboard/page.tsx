import { redirect } from "next/navigation";
import { serverApiFetch } from "../lib/api-fetch";

type Me = {
  id: string;
  email: string;
  is_admin: boolean;
};

/**
 * Auth-gated example page. This is the pattern a template user copy-pastes
 * into their own project pages: server-component + serverApiFetch +
 * redirect-on-401. user-gateway's /api/auth/verify endpoint reads the cookies
 * this request forwarded and returns the user's identity if the session is
 * valid.
 */
export default async function DashboardPage() {
  const res = await serverApiFetch("/api/auth/verify");
  if (res.status === 401 || res.status === 403) {
    redirect("/login?next=/dashboard");
  }
  if (!res.ok) {
    throw new Error(`dashboard load failed: ${res.status}`);
  }
  const me: Me = await res.json();

  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Dashboard</h1>
      <p style={{ fontSize: 15, marginBottom: 24 }}>
        Hello, <strong>{me.email}</strong>. You are{" "}
        {me.is_admin ? "an admin" : "a developer"}.
      </p>

      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
        This is where your app's authenticated experience goes. The source lives
        in <code>services/project-web/app/dashboard/page.tsx</code>.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a
          href="/profile"
          style={{
            padding: "8px 14px",
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-primary)",
            borderRadius: 4,
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          Profile
        </a>
        {me.is_admin && (
          <a
            href="/admin"
            style={{
              padding: "8px 14px",
              background: "var(--accent-blue)",
              color: "#fff",
              border: "1px solid var(--border-primary)",
              borderRadius: 4,
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            Admin panel
          </a>
        )}
      </div>
    </main>
  );
}
