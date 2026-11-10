"use client";

import {
  startTransition,
  useActionState,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { Alert, Button, type ButtonVariant } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

type ActionFormProps = {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  variant?: ButtonVariant;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  children?: ReactNode;
};

// The one form used by every action: shows pending state and the database's
// error message, and keeps what the user typed when an action is rejected.
export function ActionForm({
  action,
  submitLabel,
  variant,
  confirmMessage,
  resetOnSuccess = false,
  children,
}: ActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, dispatch, pending] = useActionState(
    async (_previous: ActionResult, formData: FormData) => {
      const result = await action(formData);

      if (!result.error && resetOnSuccess) {
        formRef.current?.reset();
      }

      return result;
    },
    { error: null },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      {children}
      {state.error && <Alert>{state.error}</Alert>}
      <Button
        type="submit"
        variant={variant}
        disabled={pending}
        className="self-start"
      >
        {pending ? "Working…" : submitLabel}
      </Button>
    </form>
  );
}
