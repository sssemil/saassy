import { redirect } from "next/navigation";

import AdminNav from "./_components/AdminNav";
import { serverApiFetch } from "../lib/api-fetch";

export const metadata = {
  title: "Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await serverApiFetch("/api/admin/me");
  if (res.status === 401 || res.status === 403) {
    redirect("/login?next=/admin");
  }
  if (!res.ok) {
    throw new Error(`Admin load failed: ${res.status}`);
  }
  const admin = await res.json();

  return (
    <>
      <AdminNav adminEmail={admin.email} />
      <main className="page-shell">{children}</main>
    </>
  );
}
