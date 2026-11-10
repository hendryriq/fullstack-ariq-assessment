"use server";

import { finishAction, readText, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function cancelLesson(formData: FormData): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_lesson", {
    p_lesson_id: readText(formData, "lesson_id"),
    p_reason: readText(formData, "reason"),
  });

  return finishAction(error);
}
