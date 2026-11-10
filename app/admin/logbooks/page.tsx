import type { Metadata } from "next";
import Link from "next/link";
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
import { formatMonth } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Logbooks" };

export default function AdminLogbooksPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminLogbooks />
    </Suspense>
  );
}

async function AdminLogbooks() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logbooks")
    .select(
      "id, month, status, submitted_at, class:classes(title), logbook_entries(id)",
    )
    .order("month", { ascending: false });

  if (error) throw error;

  // Logbooks waiting for review come first, oldest at the top.
  const waiting = data
    .filter((logbook) => logbook.status === "submitted")
    .sort((a, b) =>
      (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""),
    );
  const others = data.filter((logbook) => logbook.status !== "submitted");
  const logbooks = [...waiting, ...others];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logbooks"
        description="Review a month's logbook before it is shared with students."
      />
      <Card>
        {logbooks.length === 0 ? (
          <p className="text-sm text-muted">No logbooks yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Month</th>
                <th>Entries</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logbooks.map((logbook) => (
                <tr key={logbook.id}>
                  <td className="font-medium">{logbook.class.title}</td>
                  <td className="whitespace-nowrap">
                    {formatMonth(logbook.month)}
                  </td>
                  <td>{logbook.logbook_entries.length}</td>
                  <td>
                    <StatusBadge status={logbook.status as Status} />
                  </td>
                  <td>
                    <Link
                      href={`/admin/logbooks/${logbook.id}`}
                      className="font-medium underline"
                    >
                      {logbook.status === "submitted" ? "Review" : "View"}
                    </Link>
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
