import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, homePathFor } from "@/lib/auth";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <RedirectByRole />
    </Suspense>
  );
}

async function RedirectByRole() {
  const user = await getCurrentUser();

  redirect(user ? homePathFor(user.role) : "/login");

  return null;
}
