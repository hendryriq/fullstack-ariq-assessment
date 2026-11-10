"use server";

import { homePathFor, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
  email: string;
  redirectTo: string | null;
};

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      email,
      redirectTo: null,
      error:
        error.code === "invalid_credentials"
          ? "Incorrect email or password."
          : "Sign-in failed. Please try again.",
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      email,
      redirectTo: null,
      error: "This account does not have access.",
    };
  }

  return {
    email,
    redirectTo: homePathFor(profile.role as Role),
    error: null,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
