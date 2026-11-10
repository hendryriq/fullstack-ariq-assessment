import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  PageHeader,
  PageLoading,
  StatusBadge,
  Table,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatAge, formatDuration, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

// Three hours or less is about two 90-minute lessons.
const LOW_BALANCE_MINUTES = 180;

export default function AdminPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminOverview />
    </Suspense>
  );
}

async function AdminOverview() {
  await requireRole("admin");

  const supabase = await createClient();
  const [balances, enrollments, unpaid, margins] = await Promise.all([
    supabase
      .from("student_hours_balance")
      .select("enrollment_id, raw_balance_minutes, needs_top_up")
      .order("raw_balance_minutes"),
    supabase
      .from("enrollments")
      .select("id, student:users(full_name), class:classes(title)")
      .eq("status", "active"),
    supabase
      .from("invoices")
      .select(
        "id, amount, created_at, enrollment:enrollments(student:users(full_name), class:classes(title))",
      )
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("class_margin").select("*").order("title"),
  ]);

  if (balances.error) throw balances.error;
  if (enrollments.error) throw enrollments.error;
  if (unpaid.error) throw unpaid.error;
  if (margins.error) throw margins.error;

  const enrollmentById = new Map(
    enrollments.data.map((row) => [row.id, row]),
  );
  const unpaidTotal = unpaid.data.reduce((sum, row) => sum + row.amount, 0);
  const needTopUp = balances.data.filter((row) => row.needs_top_up).length;
  const totalMargin = margins.data.reduce(
    (sum, row) => sum + (row.margin ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Hours left, unpaid invoices and whether each class is profitable."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Unpaid invoices" value={formatRupiah(unpaidTotal)} />
        <Stat label="Students needing a top-up" value={String(needTopUp)} />
        <Stat label="Total margin" value={formatRupiah(totalMargin)} />
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Hours left</h2>
        {balances.data.length === 0 ? (
          <p className="text-sm text-muted">No active students yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Hours left</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {balances.data.map((row) => {
                const enrollment = enrollmentById.get(row.enrollment_id ?? "");
                const minutes = row.raw_balance_minutes ?? 0;

                return (
                  <tr key={row.enrollment_id}>
                    <td className="font-medium">
                      {enrollment?.student.full_name}
                    </td>
                    <td>{enrollment?.class.title}</td>
                    <td className="whitespace-nowrap font-medium">
                      {formatDuration(minutes)}
                    </td>
                    <td>
                      {row.needs_top_up ? (
                        <StatusBadge status="needs_top_up" />
                      ) : (
                        minutes <= LOW_BALANCE_MINUTES && (
                          <StatusBadge status="low_hours" />
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Unpaid invoices</h2>
          <Link href="/admin/invoices" className="text-sm font-medium underline">
            Manage invoices
          </Link>
        </div>
        {unpaid.data.length === 0 ? (
          <p className="text-sm text-muted">No unpaid invoices.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Amount</th>
                <th>Waiting</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.data.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-medium">
                    {invoice.enrollment.student.full_name}
                  </td>
                  <td>{invoice.enrollment.class.title}</td>
                  <td className="whitespace-nowrap font-medium">
                    {formatRupiah(invoice.amount)}
                  </td>
                  <td className="whitespace-nowrap">
                    {formatAge(invoice.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Class margin</h2>
        <p className="mb-4 text-sm text-muted">
          What students have paid minus what tutors have earned.
        </p>
        {margins.data.length === 0 ? (
          <p className="text-sm text-muted">No classes yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Students paid</th>
                <th>Tutors earned</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {margins.data.map((row) => {
                const margin = row.margin ?? 0;

                return (
                  <tr key={row.class_id}>
                    <td className="font-medium">{row.title}</td>
                    <td className="whitespace-nowrap">
                      {formatRupiah(row.paid_by_students ?? 0)}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatRupiah(row.earned_by_tutors ?? 0)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap font-medium">
                        {formatRupiah(margin)}
                        {margin < 0 && <StatusBadge status="loss" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  );
}
