import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { LessonTable } from "@/components/lesson-table";
import {
  Disclosure,
  Field,
  Input,
  PageHeader,
  PageLoading,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { isPast } from "@/lib/format";
import { MAX_LENGTH } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { cancelLesson } from "./actions";

export const metadata: Metadata = { title: "Schedule" };

export default function AdminSchedulePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminSchedule />
    </Suspense>
  );
}

async function AdminSchedule() {
  await requireRole("admin");

  const supabase = await createClient();
  const [classes, lessons] = await Promise.all([
    supabase.from("classes").select("id, title"),
    supabase
      .from("lessons")
      .select(
        "id, class_id, starts_at, ends_at, duration_minutes, status, cancel_reason, tutor:users!lessons_tutor_id_fkey(full_name), logbook_entries(id)",
      )
      .order("starts_at"),
  ]);

  if (classes.error) throw classes.error;
  if (lessons.error) throw lessons.error;

  const titleById = new Map(classes.data.map((row) => [row.id, row.title]));
  const upcoming = lessons.data.filter((lesson) => !isPast(lesson.ends_at));
  const past = lessons.data.filter((lesson) => isPast(lesson.ends_at)).reverse();

  // A lesson with a logbook entry is frozen, so it cannot be cancelled.
  const renderCancel = (lesson: (typeof lessons.data)[number]): ReactNode =>
    lesson.status === "scheduled" &&
    !lesson.logbook_entries && (
      <Disclosure label="Cancel">
        <ActionForm
          action={cancelLesson}
          submitLabel="Cancel lesson"
          variant="danger"
        >
          <input type="hidden" name="lesson_id" value={lesson.id} />
          <Field label="Reason">
            <Input name="reason" required maxLength={MAX_LENGTH.reason} />
          </Field>
        </ActionForm>
      </Disclosure>
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule"
        description="Every lesson across all classes. All times are in WIB."
      />
      <LessonTable
        title="Upcoming"
        emptyText="No upcoming lessons."
        lessons={upcoming}
        titleById={titleById}
        showTutor
        renderActions={renderCancel}
      />
      <LessonTable
        title="Past"
        emptyText="No past lessons."
        lessons={past}
        titleById={titleById}
        showTutor
        renderActions={renderCancel}
      />
    </div>
  );
}
