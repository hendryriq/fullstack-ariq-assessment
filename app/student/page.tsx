import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import {
  Card,
  Disclosure,
  PageHeader,
  PageLoading,
  StatusBadge,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDuration } from "@/lib/format";
import { forecastHours } from "@/lib/hours-forecast";
import { createClient } from "@/lib/supabase/server";
import { requestTopUp } from "./actions";
import { getClassCatalog } from "./class-catalog";
import { PackageField } from "./package-field";

export const metadata: Metadata = { title: "My classes" };

export default function StudentPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MyClasses />
    </Suspense>
  );
}

function formatUpcoming(count: number) {
  return `${count} upcoming ${count === 1 ? "lesson" : "lessons"}`;
}

async function MyClasses() {
  await requireRole("student");

  const supabase = await createClient();
  const [catalog, balances, upcoming] = await Promise.all([
    getClassCatalog(),
    supabase
      .from("student_hours_balance")
      .select(
        "enrollment_id, class_id, purchased_minutes, consumed_minutes, remaining_minutes, raw_balance_minutes, needs_top_up",
      ),
    supabase
      .from("lessons")
      .select("class_id, starts_at, duration_minutes")
      .eq("status", "scheduled")
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);

  if (balances.error) throw balances.error;
  if (upcoming.error) throw upcoming.error;

  const awaitingPayment = catalog.filter(
    (item) => item.my_enrollment_status === "pending_payment",
  );
  const hasNothing = balances.data.length === 0 && awaitingPayment.length === 0;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="My classes"
        description="Your paid classes and how many hours you have left."
      />

      {hasNothing && (
        <Card>
          <p className="text-sm">
            You are not enrolled in a class yet.{" "}
            <Link href="/student/classes" className="font-medium underline">
              Browse classes
            </Link>
          </p>
        </Card>
      )}

      {balances.data.map((balance) => {
        const item = catalog.find((row) => row.class_id === balance.class_id);
        const overdrawn = Math.min(balance.raw_balance_minutes ?? 0, 0);
        const forecast = forecastHours(
          balance.raw_balance_minutes ?? 0,
          upcoming.data.filter((lesson) => lesson.class_id === balance.class_id),
        );

        return (
          <Card key={balance.enrollment_id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-semibold">{item?.title}</h2>
                <p className="text-sm text-muted">Tutor: {item?.tutor_name}</p>
              </div>
              {balance.needs_top_up && <StatusBadge status="needs_top_up" />}
            </div>
            <p className="mt-4 text-2xl font-semibold">
              {formatDuration(balance.remaining_minutes ?? 0)} left
            </p>
            <p className="text-sm text-muted">
              Used {formatDuration(balance.consumed_minutes ?? 0)} of{" "}
              {formatDuration(balance.purchased_minutes ?? 0)}
            </p>
            {overdrawn < 0 && (
              <p className="mt-2 text-sm">
                You have used {formatDuration(-overdrawn)} more than you paid
                for. Your next top-up covers this first.
              </p>
            )}
            {forecast.total > 0 && (
              <p className="mt-2 text-sm">
                {forecast.firstUncoveredAt
                  ? `Not covered by your paid hours: ${formatUpcoming(forecast.uncovered)}, from ${formatDate(forecast.firstUncoveredAt)}. You need at least ${formatDuration(-forecast.minutesAfter)} more.`
                  : `Your paid hours cover ${formatUpcoming(forecast.total)}, with ${formatDuration(forecast.minutesAfter)} left after that.`}
              </p>
            )}
            <div className="mt-4">
              <Disclosure label="Buy more hours">
                <ActionForm action={requestTopUp} submitLabel="Create invoice">
                  <input
                    type="hidden"
                    name="enrollment_id"
                    value={balance.enrollment_id ?? ""}
                  />
                  <PackageField rate={item?.student_rate ?? 0} />
                </ActionForm>
              </Disclosure>
            </div>
          </Card>
        );
      })}

      {awaitingPayment.map((item) => (
        <Card key={item.class_id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="min-w-0 font-semibold">{item.title}</h2>
            <StatusBadge status="pending_payment" />
          </div>
          <p className="mt-2 text-sm">
            Your seat is held. The class opens once your invoice is paid.{" "}
            <Link href="/student/invoices" className="font-medium underline">
              View invoice
            </Link>
          </p>
        </Card>
      ))}
    </div>
  );
}
