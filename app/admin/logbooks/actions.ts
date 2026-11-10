"use server";

import { refresh } from "next/cache";
import { finishAction, readText, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function approveLogbook(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_logbook", {
    p_logbook_id: readText(formData, "logbook_id"),
    p_expected_total: Number(formData.get("expected_total")),
  });

  const result = finishAction(error);

  // If the total changed, the approval is refused. Show the admin the new numbers.
  if (result.error) {
    refresh();
  }

  return result;
}

export async function returnLogbook(formData: FormData): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_logbook", {
    p_logbook_id: readText(formData, "logbook_id"),
    p_note: readText(formData, "note"),
  });

  return finishAction(error);
}
