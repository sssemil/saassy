import { redirect } from "next/navigation";

import { serverApiFetch } from "./lib/api-fetch";

type Me = {
  is_admin: boolean;
};

export default async function Root() {
  const res = await serverApiFetch("/api/auth/verify");
  if (res.status === 401 || res.status === 403) {
    redirect("/login");
  }
  if (!res.ok) {
    throw new Error(`root auth check failed: ${res.status}`);
  }

  const me: Me = await res.json();
  redirect(me.is_admin ? "/admin" : "/dashboard");
}
