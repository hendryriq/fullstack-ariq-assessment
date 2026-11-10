"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();

      // A full page load clears pages Next keeps hidden in the browser, so the
      // next person on this computer cannot find this account's data.
      window.location.replace("/login");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={handleSignOut}
      className="md:w-full md:px-3 md:text-left"
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
