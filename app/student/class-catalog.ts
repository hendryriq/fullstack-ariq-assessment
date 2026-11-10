import "server-only";

import { createClient } from "@/lib/supabase/server";

// Class names, tutors and prices for a student. It also covers classes the
// student has not paid for yet, which RLS hides from the classes table.
export async function getClassCatalog() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_class_catalog");

  if (error) throw error;

  return data;
}
