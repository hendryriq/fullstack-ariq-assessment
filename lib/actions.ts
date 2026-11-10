import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { refresh } from "next/cache";

export type ActionResult = {
  error: string | null;
};

// P0001 is a rule raised by our database functions and 42501 is a role check.
// Both carry messages written for users. Anything else stays in the server log.
const USER_FACING_CODES = new Set(["P0001", "42501"]);

// Every Server Action ends here after calling its RPC.
export function finishAction(error: PostgrestError | null): ActionResult {
  if (error) {
    if (USER_FACING_CODES.has(error.code)) {
      return { error: error.message };
    }

    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  refresh();
  return { error: null };
}

export function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

// A datetime-local input has no time zone. Lesson times are always entered in
// WIB, whatever time zone the browser is in.
export function readWibDateTime(formData: FormData, name: string) {
  return `${readText(formData, name)}:00+07:00`;
}
