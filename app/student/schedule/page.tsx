import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonTable } from "@/components/lesson-table";
import { PageHeader, PageLoading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { isPast } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getClassCatalog } from "../class-catalog";

export const metadata: Metadata = { title: "Schedule" };

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
  const upcoming = lessons.data.filter((lesson) => !isPast(lesson.ends_at));
  const past = lessons.data.filter((lesson) => isPast(lesson.ends_at)).reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule"
        description="Lessons for your paid classes. All times are in WIB."
      />
      <LessonTable
        title="Upcoming"
        emptyText="No upcoming lessons."
        lessons={upcoming}
        titleById={titleById}
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
