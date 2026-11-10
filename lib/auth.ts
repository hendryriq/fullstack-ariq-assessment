import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "tutor" | "student";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

const HOME_PATHS: Record<Role, string> = {
  admin: "/admin",
  tutor: "/tutor",
  student: "/student",
};

export function homePathFor(role: Role) {
  return HOME_PATHS[role];
}

// Returns null when nobody is signed in or the account has no profile.
// cache() limits this to one lookup per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // A session depends on the request and the current time, so it must never
  // be prerendered.
  await connection();

  const supabase = await createClient();

  // getUser() asks Supabase Auth, so a forged or revoked session is rejected.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("email, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return {
    id: user.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as Role,
  };
});

// Every role page calls this before rendering anything for that role.
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== role) {
    redirect(homePathFor(user.role));
  }

  return user;
}
