import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader, PageLoading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatLessonTime, formatMonth } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getClassCatalog } from "../class-catalog";

export const metadata: Metadata = { title: "Logbooks" };

export default function StudentLogbooksPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StudentLogbooks />
    </Suspense>
  );
}

async function StudentLogbooks() {
  await requireRole("student");

  const supabase = await createClient();

  // RLS only returns approved logbooks of classes this student has paid for.
  const [catalog, logbooks] = await Promise.all([
    getClassCatalog(),
    supabase
      .from("logbooks")
      .select(
        "id, class_id, month, logbook_entries(id, created_at, topic, activities, tutor_observation, future_recommendation, lesson:lessons(starts_at, ends_at))",
      )
      .order("month", { ascending: false }),
  ]);

  if (logbooks.error) throw logbooks.error;

  const titleById = new Map(
    catalog.map((item) => [item.class_id, item.title]),
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Logbooks"
        description="What happened in each lesson and what comes next, once approved."
      />
      {logbooks.data.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No approved logbooks yet.</p>
        </Card>
      )}
      {logbooks.data.map((logbook) => (
        <Card key={logbook.id}>
          <h2 className="font-semibold">{titleById.get(logbook.class_id)}</h2>
          <p className="mb-4 text-sm text-muted">{formatMonth(logbook.month)}</p>
          <div className="flex flex-col gap-6">
            {sortByLesson(logbook.logbook_entries).map((entry) => (
              <article
                key={entry.id}
                className="border-t border-cloud pt-4 text-sm"
              >
                <h3 className="font-semibold">{entry.topic}</h3>
                {/* RLS hides lessons from before this student's access started. */}
                {entry.lesson && (
                  <p className="text-muted">
                    {formatLessonTime(
                      entry.lesson.starts_at,
                      entry.lesson.ends_at,
                    )}
                  </p>
                )}
                <dl className="mt-3 flex flex-col gap-3">
                  <EntryField label="Activities" value={entry.activities} />
                  <EntryField
                    label="Tutor observation"
                    value={entry.tutor_observation}
                  />
                  <EntryField
                    label="Future recommendation"
                    value={entry.future_recommendation}
                  />
                </dl>
              </article>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function sortByLesson<
  Entry extends { created_at: string; lesson: { starts_at: string } | null },
>(entries: Entry[]) {
  return [...entries].sort((a, b) =>
    (a.lesson?.starts_at ?? a.created_at).localeCompare(
      b.lesson?.starts_at ?? b.created_at,
    ),
  );
}

function EntryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-muted">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  );
}
