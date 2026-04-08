import { redirect } from "next/navigation";
import { serverApiFetch } from "../lib/api-fetch";
import AdminNav from "./_components/AdminNav";

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
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <AdminNav adminEmail={admin.email} />
      <main
        style={{
          flex: 1,
          padding: 24,
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {children}
      </main>
    </div>
  );
}
