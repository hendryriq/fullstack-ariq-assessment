import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
        <LoginForm />
        <Suspense fallback={null}>
          <RedirectIfSignedIn />
        </Suspense>
      </div>
    </main>
  );
}

async function RedirectIfSignedIn() {
  const user = await getCurrentUser();

  if (user) {
    redirect(homePathFor(user.role));
  }

  return null;
}
