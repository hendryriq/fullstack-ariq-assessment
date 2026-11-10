import { Suspense } from "react";
import { RoleHome } from "@/components/role-home";
import { requireRole } from "@/lib/auth";

export default function TutorPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <TutorHome />
    </Suspense>
  );
}

async function TutorHome() {
  const user = await requireRole("tutor");

  return <RoleHome user={user} />;
}
