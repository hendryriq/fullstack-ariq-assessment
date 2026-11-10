import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader, PageLoading, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "./actions";
import { ClassFields } from "./class-fields";

export const metadata: Metadata = { title: "Classes" };

export default function AdminClassesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ClassesContent />
    </Suspense>
  );
}

async function ClassesContent() {
  await requireRole("admin");

  const supabase = await createClient();
  const [classes, tutors] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, title, capacity, tutor:users(full_name), student_rates(rate_per_hour), tutor_rates(rate_per_hour), enrollments(status)",
      )
      .order("title"),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("role", "tutor")
      .order("full_name"),
  ]);

  if (classes.error) throw classes.error;
  if (tutors.error) throw tutors.error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Classes"
        description="Rates, capacity and the assigned tutor for each group class."
      />
      <Card>
        {classes.data.length === 0 ? (
          <p className="text-sm text-muted">No classes yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Tutor</th>
                <th>Student rate / h</th>
                <th>Tutor rate / h</th>
                <th>Seats held</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.data.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.title}</td>
                  <td>{row.tutor.full_name}</td>
                  <td>{formatRupiah(row.student_rates?.rate_per_hour ?? 0)}</td>
                  <td>{formatRupiah(row.tutor_rates?.rate_per_hour ?? 0)}</td>
                  <td>
                    {
                      row.enrollments.filter(
                        (enrollment) => enrollment.status !== "cancelled",
                      ).length
                    }{" "}
                    / {row.capacity}
                  </td>
                  <td>
                    <Link
                      href={`/admin/classes/${row.id}`}
                      className="font-medium underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">New class</h2>
        <ActionForm
          action={createClass}
          submitLabel="Create class"
          resetOnSuccess
        >
          <ClassFields tutors={tutors.data} />
        </ActionForm>
      </Card>
    </div>
  );
}
