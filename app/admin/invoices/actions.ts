"use server";

import { finishAction, readText, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markInvoicePaid(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: readText(formData, "invoice_id"),
    p_reference_note: readText(formData, "reference_note") || undefined,
  });

  return finishAction(error);
}

export async function cancelInvoice(formData: FormData): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invoice", {
    p_invoice_id: readText(formData, "invoice_id"),
    p_reason: readText(formData, "reason") || undefined,
  });

  return finishAction(error);
}

export async function voidInvoice(formData: FormData): Promise<ActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", {
    p_invoice_id: readText(formData, "invoice_id"),
    p_reason: readText(formData, "reason"),
  });

  return finishAction(error);
}
