import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import {
  Alert,
  Card,
  PageHeader,
  PageLoading,
  StatusBadge,
  Table,
  type Status,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import {
  formatLessonTime,
  formatMonth,
  formatRupiah,
  isMonthOver,
  isPast,
  wibMonthStart,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { submitLogbook } from "../actions";

export const metadata: Metadata = { title: "Logbooks" };

export default function TutorLogbooksPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TutorLogbooks />
    </Suspense>
  );
}

type GroupLesson = {
  id: string;
  starts_at: string;
  ends_at: string;
};

type MonthGroup = {
  key: string;
  title: string;
  month: string;
  lessons: GroupLesson[];
};

async function TutorLogbooks() {
  await requireRole("tutor");

  const supabase = await createClient();
  const [classes, lessons, logbooks, earnings] = await Promise.all([
    supabase.from("classes").select("id, title"),
    supabase
      .from("lessons")
      .select("id, class_id, starts_at, ends_at, status")
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase
      .from("logbooks")
      .select("id, class_id, month, status, return_note, logbook_entries(lesson_id)"),
    supabase.from("tutor_earnings").select("lesson_id, amount"),
  ]);

  if (classes.error) throw classes.error;
  if (lessons.error) throw lessons.error;
  if (logbooks.error) throw logbooks.error;
  if (earnings.error) throw earnings.error;

  // Unapproved months show the same preview the admin sees. Approved months
  // show what was actually recorded.
  const previews = await Promise.all(
    logbooks.data
      .filter((logbook) => logbook.status !== "approved")
      .map(async (logbook) => {
        const { data, error } = await supabase.rpc("preview_logbook_earnings", {
          p_logbook_id: logbook.id,
        });

        if (error) throw error;

        return data;
      }),
  );

  const amountByLesson = new Map<string, number>([
    ...previews.flat().map((row): [string, number] => [row.lesson_id, row.amount]),
    ...earnings.data.map((row): [string, number] => [row.lesson_id, row.amount]),
  ]);

  const titleById = new Map(classes.data.map((row) => [row.id, row.title]));
  const logbookByKey = new Map(
    logbooks.data.map((logbook) => [
      `${logbook.class_id}:${logbook.month}`,
      logbook,
    ]),
  );
  const writtenLessons = new Set(
    logbooks.data.flatMap((logbook) =>
      logbook.logbook_entries.map((entry) => entry.lesson_id),
    ),
  );

  const groups = new Map<string, MonthGroup>();

  for (const lesson of lessons.data) {
    const title = titleById.get(lesson.class_id);

    if (!title) continue;

    const month = wibMonthStart(lesson.starts_at);
    const key = `${lesson.class_id}:${month}`;
    const group = groups.get(key) ?? { key, title, month, lessons: [] };

    group.lessons.push(lesson);
    groups.set(key, group);
  }

  // A month with only future lessons has nothing to write yet.
  const sortedGroups = [...groups.values()]
    .filter(
      (group) =>
        logbookByKey.has(group.key) ||
        group.lessons.some((lesson) => isPast(lesson.ends_at)),
    )
    .sort(
      (a, b) =>
        b.month.localeCompare(a.month) || a.title.localeCompare(b.title),
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logbooks"
        description="One logbook per class per month, with one entry per lesson that has ended."
      />
      {sortedGroups.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            Lessons appear here once they have ended.
          </p>
        </Card>
      )}
      {sortedGroups.map((group) => {
        const logbook = logbookByKey.get(group.key);
        const status = logbook?.status ?? "draft";
        const editable = status === "draft" || status === "returned";
        const amounts = group.lessons.map((lesson) =>
          amountByLesson.get(lesson.id),
        );
        const total = amounts.reduce<number>(
          (sum, amount) => sum + (amount ?? 0),
          0,
        );

        return (
          <Card key={group.key}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-semibold">{group.title}</h2>
                <p className="text-sm text-muted">{formatMonth(group.month)}</p>
              </div>
              <StatusBadge status={status as Status} />
            </div>

            {logbook?.return_note && (
              <div className="mb-4">
                <Alert>Returned by admin: {logbook.return_note}</Alert>
              </div>
            )}

            <Table>
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Entry</th>
                  <th>{status === "approved" ? "Earned" : "Estimated"}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.lessons.map((lesson, index) => {
                  const written = writtenLessons.has(lesson.id);
                  const ended = isPast(lesson.ends_at);
                  const amount = amounts[index];

                  return (
                    <tr key={lesson.id}>
                      <td className="whitespace-nowrap">
                        {formatLessonTime(lesson.starts_at, lesson.ends_at)}
                      </td>
                      <td>
                        {written
                          ? "Written"
                          : ended
                            ? "Needs entry"
                            : "Not finished"}
                      </td>
                      <td className="whitespace-nowrap">
                        {amount === undefined ? "-" : formatRupiah(amount)}
                      </td>
                      <td>
                        {(written || ended) && (
                          <Link
                            href={`/tutor/lessons/${lesson.id}`}
                            className="font-medium whitespace-nowrap underline"
                          >
                            {!editable
                              ? "View"
                              : written
                                ? "Edit"
                                : "Write entry"}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <p className="mt-4 text-sm font-medium">
              {status === "approved" ? "Total earned" : "Estimated total"}:{" "}
              {formatRupiah(total)}
            </p>

            {logbook && editable && (
              <div className="mt-4">
                {isMonthOver(group.month) ? (
                  <ActionForm
                    action={submitLogbook}
                    submitLabel="Submit for approval"
                    confirmMessage="Submit this logbook for approval? You cannot edit it while it is being reviewed."
                  >
                    <input type="hidden" name="logbook_id" value={logbook.id} />
                  </ActionForm>
                ) : (
                  <p className="text-sm text-muted">
                    You can submit this logbook after {formatMonth(group.month)}{" "}
                    ends.
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
