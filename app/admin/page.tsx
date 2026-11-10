import { Suspense } from "react";
import { RoleHome } from "@/components/role-home";
import { requireRole } from "@/lib/auth";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const user = await requireRole("admin");

  return <RoleHome user={user} />;
}
