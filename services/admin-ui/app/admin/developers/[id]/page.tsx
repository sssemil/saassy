import { redirect } from "next/navigation";

import { serverApiFetch } from "../../../lib/api-fetch";

type Developer = {
  owner_user_id: string | null;
};

export default async function DeveloperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const developerRes = await serverApiFetch(`/api/admin/developers/${id}`);
  if (developerRes.status === 404) {
    redirect("/admin/users");
  }
  if (!developerRes.ok) {
    throw new Error(`developer load failed: ${developerRes.status}`);
  }

  const developer: Developer = await developerRes.json();
  if (!developer.owner_user_id) {
    redirect("/admin/users");
  }

  redirect(`/admin/users/${developer.owner_user_id}`);
}
