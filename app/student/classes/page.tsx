import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader, PageLoading, StatusBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { enrollInClass } from "../actions";
import { getClassCatalog } from "../class-catalog";
import { PackageField } from "../package-field";

export const metadata: Metadata = { title: "Browse classes" };

export default function BrowseClassesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BrowseClasses />
    </Suspense>
  );
}

async function BrowseClasses() {
  await requireRole("student");

  const catalog = await getClassCatalog();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Browse classes"
        description="Choose a class and a package of hours. You receive an invoice, and the class opens once it is paid."
      />
      {catalog.length === 0 && (
        <p className="text-sm text-muted">No classes are available yet.</p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {catalog.map((item) => (
          <Card key={item.class_id}>
            <h2 className="font-semibold">{item.title}</h2>
            <p className="text-sm text-muted">Tutor: {item.tutor_name}</p>
            {item.description && (
              <p className="mt-3 text-sm">{item.description}</p>
            )}
            <p className="mt-3 text-sm font-medium">
              {formatRupiah(item.student_rate)} per hour
            </p>
            <p className="mb-4 text-sm text-muted">
              {Math.max(item.seats_left, 0)} of {item.capacity} seats left
            </p>
            <EnrollmentState item={item} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function EnrollmentState({
  item,
}: {
  item: Awaited<ReturnType<typeof getClassCatalog>>[number];
}) {
  if (item.my_enrollment_status === "active") {
    return (
      <div className="flex items-center gap-3">
        <StatusBadge status="active" />
        <Link href="/student/schedule" className="text-sm font-medium underline">
          View schedule
        </Link>
      </div>
    );
  }

  if (item.my_enrollment_status === "pending_payment") {
    return (
      <div className="flex items-center gap-3">
        <StatusBadge status="pending_payment" />
        <Link href="/student/invoices" className="text-sm font-medium underline">
          View invoice
        </Link>
      </div>
    );
  }

  if (item.seats_left <= 0) {
    return <p className="text-sm font-medium text-muted">This class is full.</p>;
  }

  return (
    <ActionForm action={enrollInClass} submitLabel="Enroll">
      <input type="hidden" name="class_id" value={item.class_id} />
      <PackageField rate={item.student_rate} />
    </ActionForm>
  );
}
