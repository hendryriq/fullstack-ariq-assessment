"use server";

import { redirect } from "next/navigation";
import {
  finishAction,
  readText,
  readWibDateTime,
  type ActionResult,
} from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function scheduleLesson(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("tutor");

  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_lesson", {
    p_class_id: readText(formData, "class_id"),
    p_starts_at: readWibDateTime(formData, "starts_at"),
    p_ends_at: readWibDateTime(formData, "ends_at"),
  });

  return finishAction(error);
}

export async function cancelLesson(formData: FormData): Promise<ActionResult> {
  await requireRole("tutor");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_lesson", {
    p_lesson_id: readText(formData, "lesson_id"),
    p_reason: readText(formData, "reason"),
  });

  return finishAction(error);
}

export async function saveLogbookEntry(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("tutor");

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_logbook_entry", {
    p_lesson_id: readText(formData, "lesson_id"),
    p_topic: readText(formData, "topic"),
    p_activities: readText(formData, "activities"),
    p_tutor_observation: readText(formData, "tutor_observation"),
    p_future_recommendation: readText(formData, "future_recommendation"),
  });

  const result = finishAction(error);

  if (!result.error) {
    redirect("/tutor/logbooks");
  }

  return result;
}

export async function removeLogbookEntry(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("tutor");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_logbook_entry", {
    p_lesson_id: readText(formData, "lesson_id"),
  });

  const result = finishAction(error);

  if (!result.error) {
    redirect("/tutor/logbooks");
  }

  return result;
}

export async function submitLogbook(formData: FormData): Promise<ActionResult> {
  await requireRole("tutor");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_logbook", {
    p_logbook_id: readText(formData, "logbook_id"),
  });

  return finishAction(error);
}
