"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/developers", label: "Developers" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  return (
    <nav
      style={{
        borderBottom: "1px solid var(--border-primary)",
        background: "var(--bg-secondary)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <strong style={{ marginRight: 16 }}>Admin</strong>
      {LINKS.map((l) => {
        const active =
          l.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              textDecoration: "none",
              padding: "4px 8px",
              borderBottom: active
                ? "2px solid var(--accent-blue)"
                : "2px solid transparent",
            }}
          >
            {l.label}
          </Link>
        );
      })}
      <span style={{ flex: 1 }} />
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
        {adminEmail}
      </span>
      <button
        onClick={logout}
        style={{
          background: "transparent",
          border: "1px solid var(--border-primary)",
          color: "var(--text-secondary)",
          padding: "4px 10px",
          borderRadius: 4,
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
