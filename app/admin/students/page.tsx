import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import {
  Card,
  Disclosure,
  Field,
  Input,
  PageHeader,
  PageLoading,
  StatusBadge,
  Table,
  type Status,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { MAX_LENGTH } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { endEnrollment } from "./actions";

export const metadata: Metadata = { title: "Students" };

export default function AdminStudentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StudentsContent />
    </Suspense>
  );
}

async function StudentsContent() {
  await requireRole("admin");

  const supabase = await createClient();
  const [students, balances] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, full_name, email, enrollments(id, status, class:classes(title))",
      )
      .eq("role", "student")
      .order("full_name"),
    supabase
      .from("student_hours_balance")
      .select("enrollment_id, raw_balance_minutes, needs_top_up"),
  ]);

  if (students.error) throw students.error;
  if (balances.error) throw balances.error;

  const balanceByEnrollment = new Map(
    balances.data.map((balance) => [balance.enrollment_id, balance]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Students"
        description="Enrollments and hours left. A negative balance means the student is overdrawn."
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Status</th>
              <th>Hours left</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.data.map((student) =>
              student.enrollments.length === 0 ? (
                <tr key={student.id}>
                  <StudentCell
                    name={student.full_name}
                    email={student.email}
                  />
                  <td className="text-muted" colSpan={4}>
                    Not enrolled
                  </td>
                </tr>
              ) : (
                student.enrollments.map((enrollment) => {
                  const balance = balanceByEnrollment.get(enrollment.id);

                  return (
                    <tr key={enrollment.id} className="align-top">
                      <StudentCell
                        name={student.full_name}
                        email={student.email}
                      />
                      <td>{enrollment.class.title}</td>
                      <td>
                        <StatusBadge status={enrollment.status as Status} />
                      </td>
                      <td>
                        {balance ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="whitespace-nowrap font-medium">
                              {formatDuration(balance.raw_balance_minutes ?? 0)}
                            </span>
                            {balance.needs_top_up && (
                              <StatusBadge status="needs_top_up" />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>
                        {enrollment.status === "active" && (
                          <Disclosure label="End enrollment">
                            <ActionForm
                              action={endEnrollment}
                              submitLabel="End enrollment"
                              variant="danger"
                              confirmMessage="End this enrollment? The seat is freed, access ends and unused hours are not carried over."
                            >
                              <input
                                type="hidden"
                                name="enrollment_id"
                                value={enrollment.id}
                              />
                              <Field label="Reason">
                                <Input
                                  name="reason"
                                  required
                                  maxLength={MAX_LENGTH.reason}
                                />
                              </Field>
                            </ActionForm>
                          </Disclosure>
                        )}
                      </td>
                    </tr>
                  );
                })
              ),
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function StudentCell({ name, email }: { name: string; email: string }) {
  return (
    <td>
      <p className="font-medium">{name}</p>
      <p className="text-muted">{email}</p>
    </td>
  );
}
