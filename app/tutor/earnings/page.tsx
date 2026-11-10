import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, PageHeader, PageLoading, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import {
  formatDuration,
  formatLessonTime,
  formatRupiah,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Earnings" };

export default function TutorEarningsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TutorEarnings />
    </Suspense>
  );
}

async function TutorEarnings() {
  await requireRole("tutor");

  const supabase = await createClient();

  // RLS only returns this tutor's own earnings.
  const { data, error } = await supabase
    .from("tutor_earnings")
    .select(
      "id, amount, duration_minutes, rate_per_hour, lesson:lessons(starts_at, ends_at), class:classes(title)",
    );

  if (error) throw error;

  const earnings = [...data].sort((a, b) =>
    b.lesson.starts_at.localeCompare(a.lesson.starts_at),
  );
  const total = earnings.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Earnings"
        description="Recorded per lesson when a logbook is approved."
      />
      <Card>
        <p className="text-sm text-muted">Total earned</p>
        <p className="text-2xl font-semibold">{formatRupiah(total)}</p>
        <p className="mt-2 text-sm">
          Estimates for months not yet approved are on{" "}
          <Link href="/tutor/logbooks" className="font-medium underline">
            Logbooks
          </Link>
          .
        </p>
      </Card>
      <Card>
        {earnings.length === 0 ? (
          <p className="text-sm text-muted">
            No earnings yet. They appear once a logbook is approved.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Lesson</th>
                <th>Duration</th>
                <th>Rate / h</th>
                <th>Earned</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((row) => (
                <tr key={row.id}>
                  {/* RLS hides a class this tutor no longer teaches. */}
                  <td className="font-medium">
                    {row.class?.title ?? "Former class"}
                  </td>
                  <td className="whitespace-nowrap">
                    {formatLessonTime(row.lesson.starts_at, row.lesson.ends_at)}
                  </td>
                  <td className="whitespace-nowrap">
                    {formatDuration(row.duration_minutes)}
                  </td>
                  <td className="whitespace-nowrap">
                    {formatRupiah(row.rate_per_hour)}
                  </td>
                  <td className="whitespace-nowrap font-medium">
                    {formatRupiah(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
