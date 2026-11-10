import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { LogbookEntryFields } from "@/components/logbook-entry-fields";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  PageLoading,
  Textarea,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatLessonTime, isPast } from "@/lib/format";
import { MAX_LENGTH } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { removeLogbookEntry, saveLogbookEntry } from "../../actions";

export const metadata: Metadata = { title: "Logbook entry" };

export default function LessonEntryPage({
  params,
}: PageProps<"/tutor/lessons/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <LessonEntry id={id} />
      ))}
    </Suspense>
  );
}

async function LessonEntry({ id }: { id: string }) {
  await requireRole("tutor");

  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select(
      "id, starts_at, ends_at, status, class:classes(title), logbook_entries(topic, activities, tutor_observation, future_recommendation, logbook:logbooks(status, return_note))",
    )
    .eq("id", id)
    .maybeSingle();

  // RLS hides the class from a tutor who is no longer assigned to it.
  if (error || !lesson || !lesson.class) notFound();

  const entry = lesson.logbook_entries;
  const logbookStatus = entry?.logbook.status;
  const logbookOpen =
    !logbookStatus || logbookStatus === "draft" || logbookStatus === "returned";
  const canWrite =
    lesson.status === "scheduled" && isPast(lesson.ends_at) && logbookOpen;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/tutor/logbooks" className="text-sm font-medium underline">
        Back to logbooks
      </Link>
      <PageHeader
        title={lesson.class.title}
        description={formatLessonTime(lesson.starts_at, lesson.ends_at)}
      />

      {entry?.logbook.return_note && (
        <Alert>Returned by admin: {entry.logbook.return_note}</Alert>
      )}

      {canWrite && (
        <Card>
          <ActionForm action={saveLogbookEntry} submitLabel="Save entry">
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <Field label="Topic">
              <Input
                name="topic"
                required
                maxLength={MAX_LENGTH.entryTopic}
                defaultValue={entry?.topic}
              />
            </Field>
            <Field label="Activities">
              <Textarea
                name="activities"
                rows={4}
                required
                maxLength={MAX_LENGTH.entryText}
                defaultValue={entry?.activities}
              />
            </Field>
            <Field label="Tutor observation">
              <Textarea
                name="tutor_observation"
                rows={4}
                required
                maxLength={MAX_LENGTH.entryText}
                defaultValue={entry?.tutor_observation}
              />
            </Field>
            <Field label="Future recommendation">
              <Textarea
                name="future_recommendation"
                rows={4}
                required
                maxLength={MAX_LENGTH.entryText}
                defaultValue={entry?.future_recommendation}
              />
            </Field>
          </ActionForm>
        </Card>
      )}

      {canWrite && entry && (
        <Card>
          <h2 className="font-semibold">Remove this entry</h2>
          <p className="mb-4 text-sm text-muted">
            Use this if the lesson did not happen or its time is wrong. The
            admin can then cancel the lesson.
          </p>
          <ActionForm
            action={removeLogbookEntry}
            submitLabel="Remove entry"
            variant="danger"
            confirmMessage="Remove this logbook entry?"
          >
            <input type="hidden" name="lesson_id" value={lesson.id} />
          </ActionForm>
        </Card>
      )}

      {!canWrite && entry && (
        <Card>
          <h2 className="mb-3 font-semibold">{entry.topic}</h2>
          <LogbookEntryFields entry={entry} />
        </Card>
      )}

      {!canWrite && !entry && (
        <Card>
          <p className="text-sm text-muted">
            {lesson.status === "cancelled"
              ? "This lesson was cancelled, so it has no logbook entry."
              : "You can write this entry after the lesson has ended."}
          </p>
        </Card>
      )}
    </div>
  );
}
