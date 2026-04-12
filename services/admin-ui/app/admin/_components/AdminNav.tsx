"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  return (
    <nav className="topbar-shell">
      <div className="topbar">
        <Link href="/admin" className="topbar-brand">
          Shardd Admin
        </Link>
        {LINKS.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`pill-link${active ? " active" : ""}`}
            >
              {l.label}
            </Link>
          );
        })}
        <div className="topbar-meta">
          <span className="badge badge-neutral">{adminEmail}</span>
          <button type="button" onClick={logout} className="button-secondary">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
