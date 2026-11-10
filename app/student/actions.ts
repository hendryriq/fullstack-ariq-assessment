"use server";

import { redirect } from "next/navigation";
import { finishAction, readText, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function enrollInClass(formData: FormData): Promise<ActionResult> {
  await requireRole("student");

  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_student", {
    p_class_id: readText(formData, "class_id"),
    p_hours: Number(formData.get("hours")),
  });

  const result = finishAction(error);

  if (!result.error) {
    redirect("/student/invoices");
  }

  return result;
}

export async function requestTopUp(formData: FormData): Promise<ActionResult> {
  await requireRole("student");

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_top_up", {
    p_enrollment_id: readText(formData, "enrollment_id"),
    p_hours: Number(formData.get("hours")),
  });

  const result = finishAction(error);

  if (!result.error) {
    redirect("/student/invoices");
  }

  return result;
}
