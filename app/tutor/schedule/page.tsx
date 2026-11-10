import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { LessonTable } from "@/components/lesson-table";
import {
  Card,
  Disclosure,
  Field,
  Input,
  PageHeader,
  PageLoading,
  Select,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { isPast } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cancelLesson, scheduleLesson } from "../actions";

export const metadata: Metadata = { title: "Schedule" };

export default function TutorSchedulePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TutorSchedule />
    </Suspense>
  );
}

async function TutorSchedule() {
  const user = await requireRole("tutor");

  const supabase = await createClient();
  const [classes, lessons] = await Promise.all([
    supabase.from("classes").select("id, title").order("title"),
    supabase
      .from("lessons")
      .select(
        "id, tutor_id, class_id, starts_at, ends_at, duration_minutes, status, cancel_reason",
      )
      .order("starts_at"),
  ]);

  if (classes.error) throw classes.error;
  if (lessons.error) throw lessons.error;

  const titleById = new Map(classes.data.map((row) => [row.id, row.title]));
  const assigned = lessons.data.filter((lesson) =>
    titleById.has(lesson.class_id),
  );
  const upcoming = assigned.filter((lesson) => !isPast(lesson.ends_at));
  const past = assigned.filter((lesson) => isPast(lesson.ends_at)).reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule"
        description="Lessons for your classes. All times are in WIB."
      />
      <Card>
        <h2 className="mb-4 font-semibold">New lesson</h2>
        {classes.data.length === 0 ? (
          <p className="text-sm text-muted">
            You need an assigned class before you can schedule lessons.
          </p>
        ) : (
          <ActionForm
            action={scheduleLesson}
            submitLabel="Add lesson"
            resetOnSuccess
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Class">
                <Select name="class_id" required defaultValue="">
                  <option value="" disabled>
                    Choose a class
                  </option>
                  {classes.data.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Starts (WIB)">
                <Input name="starts_at" type="datetime-local" required />
              </Field>
              <Field label="Ends (WIB)">
                <Input name="ends_at" type="datetime-local" required />
              </Field>
            </div>
          </ActionForm>
        )}
      </Card>
      <LessonTable
        title="Upcoming"
        emptyText="No upcoming lessons."
        lessons={upcoming}
        titleById={titleById}
        renderActions={(lesson) =>
          lesson.status === "scheduled" &&
          lesson.tutor_id === user.id &&
          !isPast(lesson.starts_at) && (
            <Disclosure label="Cancel">
              <ActionForm
                action={cancelLesson}
                submitLabel="Cancel lesson"
                variant="danger"
              >
                <input type="hidden" name="lesson_id" value={lesson.id} />
                <Field label="Reason">
                  <Input name="reason" required />
                </Field>
              </ActionForm>
            </Disclosure>
          )
        }
      />
      <LessonTable
        title="Past"
        emptyText="No past lessons."
        lessons={past}
        titleById={titleById}
      />
    </div>
  );
}
