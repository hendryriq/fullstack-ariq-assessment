import { Suspense } from "react";
import { RoleHome } from "@/components/role-home";
import { requireRole } from "@/lib/auth";

export default function StudentPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <StudentHome />
    </Suspense>
  );
}

async function StudentHome() {
  const user = await requireRole("student");

  return <RoleHome user={user} />;
}
