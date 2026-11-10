import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader, PageLoading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My classes" };

export default function TutorPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TutorClasses />
    </Suspense>
  );
}

async function TutorClasses() {
  await requireRole("tutor");

  const supabase = await createClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, title, description, capacity, tutor_rates(rate_per_hour)")
    .order("title");

  if (error) throw error;

  const rosters = await Promise.all(
    classes.map(async (row) => {
      const { data, error: rosterError } = await supabase.rpc(
        "get_class_roster",
        { p_class_id: row.id },
      );

      if (rosterError) throw rosterError;

      return data;
    }),
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="My classes"
        description="The classes assigned to you and the students who have paid."
      />
      {classes.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            You have no classes assigned yet.
          </p>
        </Card>
      )}
      {classes.map((row, index) => (
        <Card key={row.id}>
          <h2 className="font-semibold">{row.title}</h2>
          {row.description && (
            <p className="mt-1 text-sm text-muted">{row.description}</p>
          )}
          <p className="mt-3 text-sm font-medium">
            Your rate: {formatRupiah(row.tutor_rates?.rate_per_hour ?? 0)} per
            hour
          </p>
          <h3 className="mt-4 text-sm font-medium text-muted">
            Students ({rosters[index].length} of {row.capacity})
          </h3>
          {rosters[index].length === 0 ? (
            <p className="text-sm">No paid students yet.</p>
          ) : (
            <ul className="text-sm">
              {rosters[index].map((student) => (
                <li key={student.student_id}>{student.full_name}</li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
