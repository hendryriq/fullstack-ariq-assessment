"use server";

import { redirect } from "next/navigation";
import { finishAction, readText, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function readClassFields(formData: FormData) {
  return {
    p_title: readText(formData, "title"),
    p_description: readText(formData, "description"),
    p_capacity: Number(formData.get("capacity")),
    p_tutor_id: readText(formData, "tutor_id"),
    p_student_rate: Number(formData.get("student_rate")),
    p_tutor_rate: Number(formData.get("tutor_rate")),
  };
}

export async function createClass(formData: FormData): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "create_class",
    readClassFields(formData),
  );

  return finishAction(error);
}

export async function updateClass(formData: FormData): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_class", {
    p_class_id: readText(formData, "class_id"),
    ...readClassFields(formData),
  });

  const result = finishAction(error);

  if (!result.error) {
    redirect("/admin/classes");
  }

  return result;
}
