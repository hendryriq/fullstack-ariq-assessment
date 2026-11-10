"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

const initialState: LoginState = { error: null, email: "", redirectTo: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(
    async (previous: LoginState, formData: FormData) => {
      const result = await signIn(previous, formData);

      // A full page load clears pages Next keeps hidden from the previous user.
      if (result.redirectTo) {
        window.location.replace(result.redirectTo);
      }

      return result;
    },
    initialState,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
        />
      </Field>
      <Field label="Password">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
