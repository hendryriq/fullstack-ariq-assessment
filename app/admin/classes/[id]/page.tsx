import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader, PageLoading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateClass } from "../actions";
import { ClassFields } from "../class-fields";

export const metadata: Metadata = { title: "Edit class" };

export default function EditClassPage({
  params,
}: PageProps<"/admin/classes/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <EditClassContent id={id} />
      ))}
    </Suspense>
  );
}

async function EditClassContent({ id }: { id: string }) {
  await requireRole("admin");

  const supabase = await createClient();
  const [classRow, tutors] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, title, description, capacity, tutor_id, student_rates(rate_per_hour), tutor_rates(rate_per_hour)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("role", "tutor")
      .order("full_name"),
  ]);

  if (classRow.error || !classRow.data) notFound();
  if (tutors.error) throw tutors.error;

  const values = classRow.data;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/classes" className="text-sm font-medium underline">
        Back to classes
      </Link>
      <PageHeader title={`Edit ${values.title}`} />
      <Card>
        <ActionForm action={updateClass} submitLabel="Save changes">
          <input type="hidden" name="class_id" value={values.id} />
          <ClassFields
            tutors={tutors.data}
            values={{
              title: values.title,
              description: values.description ?? "",
              capacity: values.capacity,
              tutorId: values.tutor_id,
              studentRate: values.student_rates?.rate_per_hour ?? 0,
              tutorRate: values.tutor_rates?.rate_per_hour ?? 0,
            }}
          />
        </ActionForm>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">What these changes affect</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>
            <strong className="font-medium">Student rate:</strong> applies to
            new invoices and top-ups. Existing invoices keep their price.
          </li>
          <li>
            <strong className="font-medium">Tutor rate:</strong> applies to
            every logbook approved after this change, including lessons already
            taught.
          </li>
          <li>
            <strong className="font-medium">Capacity:</strong> cannot go below
            the seats currently held.
          </li>
          <li>
            <strong className="font-medium">Tutor:</strong> only lessons that
            have not started move to the new tutor. Students keep their hours
            and access.
          </li>
        </ul>
      </Card>
    </div>
  );
}
