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
  PageHeader,
  PageLoading,
  StatusBadge,
  Table,
  Textarea,
  type Status,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import {
  formatDuration,
  formatLessonTime,
  formatMonth,
  formatRupiah,
} from "@/lib/format";
import { MAX_LENGTH } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { approveLogbook, returnLogbook } from "../actions";

export const metadata: Metadata = { title: "Review logbook" };

export default function ReviewLogbookPage({
  params,
}: PageProps<"/admin/logbooks/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <ReviewLogbook id={id} />
      ))}
    </Suspense>
  );
}

async function ReviewLogbook({ id }: { id: string }) {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: logbook, error } = await supabase
    .from("logbooks")
    .select(
      "id, month, status, return_note, class:classes(title), logbook_entries(id, lesson_id, topic, activities, tutor_observation, future_recommendation, lesson:lessons(starts_at, ends_at, tutor:users!lessons_tutor_id_fkey(full_name)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !logbook) notFound();

  // Approved logbooks show what was recorded. Others show the live preview.
  const approved = logbook.status === "approved";
  const { data: earnings, error: earningsError } = approved
    ? await supabase
        .from("tutor_earnings")
        .select("lesson_id, duration_minutes, rate_per_hour, amount")
        .eq("logbook_id", id)
    : await supabase.rpc("preview_logbook_earnings", { p_logbook_id: id });

  if (earningsError) throw earningsError;

  const earningsByLesson = new Map(
    earnings.map((row) => [row.lesson_id, row]),
  );
  const total = earnings.reduce((sum, row) => sum + row.amount, 0);
  const entries = [...logbook.logbook_entries].sort((a, b) =>
    a.lesson.starts_at.localeCompare(b.lesson.starts_at),
  );

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link href="/admin/logbooks" className="text-sm font-medium underline">
        Back to logbooks
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={logbook.class.title}
          description={formatMonth(logbook.month)}
        />
        <StatusBadge status={logbook.status as Status} />
      </div>

      {logbook.return_note && (
        <Alert>Returned to the tutor: {logbook.return_note}</Alert>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">
          {approved ? "Recorded earnings" : "Earnings preview"}
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">This logbook has no entries yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Tutor</th>
                <th>Duration</th>
                <th>Rate / h</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const row = earningsByLesson.get(entry.lesson_id);

                return (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap">
                      {formatLessonTime(
                        entry.lesson.starts_at,
                        entry.lesson.ends_at,
                      )}
                    </td>
                    <td>{entry.lesson.tutor.full_name}</td>
                    <td className="whitespace-nowrap">
                      {formatDuration(row?.duration_minutes ?? 0)}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatRupiah(row?.rate_per_hour ?? 0)}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {formatRupiah(row?.amount ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="mt-4 font-semibold">Total: {formatRupiah(total)}</p>
      </Card>

      {entries.map((entry) => (
        <Card key={entry.id}>
          <h2 className="font-semibold">{entry.topic}</h2>
          <p className="mb-3 text-sm text-muted">
            {formatLessonTime(entry.lesson.starts_at, entry.lesson.ends_at)}
          </p>
          <LogbookEntryFields entry={entry} />
        </Card>
      ))}

      {logbook.status === "submitted" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-1 font-semibold">Approve</h2>
            <p className="mb-4 text-sm text-muted">
              Records {formatRupiah(total)} in tutor earnings and shares this
              logbook with students. It cannot be changed afterwards.
            </p>
            <ActionForm
              action={approveLogbook}
              submitLabel="Approve logbook"
              confirmMessage={`Approve this logbook and record ${formatRupiah(total)} in tutor earnings?`}
            >
              <input type="hidden" name="logbook_id" value={logbook.id} />
              <input type="hidden" name="expected_total" value={total} />
            </ActionForm>
          </Card>
          <Card>
            <h2 className="mb-1 font-semibold">Return for revision</h2>
            <p className="mb-4 text-sm text-muted">
              The tutor sees your note and can correct the logbook.
            </p>
            <ActionForm
              action={returnLogbook}
              submitLabel="Return to tutor"
              variant="danger"
            >
              <input type="hidden" name="logbook_id" value={logbook.id} />
              <Field label="Note">
                <Textarea
                  name="note"
                  rows={3}
                  required
                  maxLength={MAX_LENGTH.returnNote}
                />
              </Field>
            </ActionForm>
          </Card>
        </div>
      )}
    </div>
  );
}
