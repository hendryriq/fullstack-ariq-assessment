import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { NavLink, NavLinkFallback } from "@/components/nav-link";
import { Button } from "@/components/ui";
import { getCurrentUser, type Role } from "@/lib/auth";

// Each role's pages are added here as they are built.
const NAV_ITEMS: Record<Role, { href: string; label: string }[]> = {
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/classes", label: "Classes" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/students", label: "Students" },
  ],
  tutor: [{ href: "/tutor", label: "Overview" }],
  student: [{ href: "/student", label: "Overview" }],
};

// The sidebar is layout only. Access is still checked by requireRole() on each page.
export function AppShell({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-4 bg-navy p-4 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:gap-8 md:p-6">
        <Brand />
        <nav aria-label="Main" className="flex flex-wrap gap-1 md:flex-col">
          {NAV_ITEMS[role].map((item) => (
            <Suspense key={item.href} fallback={<NavLinkFallback {...item} />}>
              <NavLink {...item} />
            </Suspense>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 md:mt-auto md:flex-col md:items-stretch">
          <Suspense fallback={null}>
            <SignedInName />
          </Suspense>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="md:w-full md:px-3 md:text-left"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

async function SignedInName() {
  const user = await getCurrentUser();

  return user ? (
    <p className="text-sm text-white/80 md:px-3">{user.fullName}</p>
  ) : null;
}
