"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
  href: string;
  label: string;
};

function linkClass(active: boolean) {
  return `rounded-card px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
    active ? "bg-gold text-navy" : "text-white hover:bg-white/10"
  }`;
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();

  // A role's home (/admin) matches exactly; other items include their sub-pages.
  const isRoleHome = href.lastIndexOf("/") === 0;
  const active = isRoleHome ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={linkClass(active)}
    >
      {label}
    </Link>
  );
}

// Shown while the current path is unknown, on routes such as /admin/classes/[id].
export function NavLinkFallback({ href, label }: NavLinkProps) {
  return (
    <Link href={href} className={linkClass(false)}>
      {label}
    </Link>
  );
}
