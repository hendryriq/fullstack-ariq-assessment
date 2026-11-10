import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Brand />
        <Card>
          <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
          <LoginForm />
        </Card>
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
