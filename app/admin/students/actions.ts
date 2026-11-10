"use server";

import { finishAction, readText, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function endEnrollment(formData: FormData): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_enrollment", {
    p_enrollment_id: readText(formData, "enrollment_id"),
    p_reason: readText(formData, "reason"),
  });

  return finishAction(error);
}
