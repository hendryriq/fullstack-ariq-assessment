import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  PageHeader,
  PageLoading,
  StatusBadge,
  Table,
  type Status,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDuration, formatLessonTime, hasEnded } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getClassCatalog } from "../class-catalog";

export const metadata: Metadata = { title: "Schedule" };

type Lesson = {
  id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number | null;
  status: string;
  cancel_reason: string | null;
};

export default function StudentSchedulePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StudentSchedule />
    </Suspense>
  );
}

async function StudentSchedule() {
  await requireRole("student");

  const supabase = await createClient();
  const [catalog, lessons] = await Promise.all([
    getClassCatalog(),
    supabase
      .from("lessons")
      .select(
        "id, class_id, starts_at, ends_at, duration_minutes, status, cancel_reason",
      )
      .order("starts_at"),
  ]);

  if (lessons.error) throw lessons.error;

  const titleById = new Map(
    catalog.map((item) => [item.class_id, item.title]),
  );
  const upcoming = lessons.data.filter((lesson) => !hasEnded(lesson.ends_at));
  const past = lessons.data
    .filter((lesson) => hasEnded(lesson.ends_at))
    .reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule"
        description="Lessons for your paid classes. All times are in WIB."
      />
      <LessonSection
        title="Upcoming"
        emptyText="No upcoming lessons."
        lessons={upcoming}
        titleById={titleById}
      />
      <LessonSection
        title="Past"
        emptyText="No past lessons."
        lessons={past}
        titleById={titleById}
      />
    </div>
  );
}

function LessonSection({
  title,
  emptyText,
  lessons,
  titleById,
}: {
  title: string;
  emptyText: string;
  lessons: Lesson[];
  titleById: Map<string, string>;
}) {
  return (
    <Card>
      <h2 className="mb-4 font-semibold">{title}</h2>
      {lessons.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Time</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.id} className="align-top">
                <td className="font-medium">{titleById.get(lesson.class_id)}</td>
                <td className="whitespace-nowrap">
                  {formatLessonTime(lesson.starts_at, lesson.ends_at)}
                </td>
                <td className="whitespace-nowrap">
                  {formatDuration(lesson.duration_minutes ?? 0)}
                </td>
                <td>
                  <StatusBadge status={lesson.status as Status} />
                  {lesson.cancel_reason && (
                    <p className="mt-1 text-muted">{lesson.cancel_reason}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
