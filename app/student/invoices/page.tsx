import type { Metadata } from "next";
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
import { formatDateTime, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getClassCatalog } from "../class-catalog";

export const metadata: Metadata = { title: "Invoices" };

export default function StudentInvoicesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StudentInvoices />
    </Suspense>
  );
}

async function StudentInvoices() {
  await requireRole("student");

  const supabase = await createClient();
  const [catalog, invoices] = await Promise.all([
    getClassCatalog(),
    supabase
      .from("invoices")
      .select(
        "id, hours, rate_snapshot, amount, status, created_at, void_reason, enrollment:enrollments(class_id)",
      )
      .order("created_at", { ascending: false }),
  ]);

  if (invoices.error) throw invoices.error;

  const titleById = new Map(
    catalog.map((item) => [item.class_id, item.title]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="Payment is simulated. An admin confirms your payment, then your class opens."
      />
      <Card>
        {invoices.data.length === 0 ? (
          <p className="text-sm text-muted">You have no invoices yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {invoices.data.map((invoice) => (
                <tr key={invoice.id} className="align-top">
                  <td className="font-medium">
                    {titleById.get(invoice.enrollment.class_id)}
                  </td>
                  <td className="whitespace-nowrap">
                    {invoice.hours} h × {formatRupiah(invoice.rate_snapshot)}
                  </td>
                  <td className="whitespace-nowrap font-medium">
                    {formatRupiah(invoice.amount)}
                  </td>
                  <td>
                    <StatusBadge status={invoice.status as Status} />
                    {invoice.void_reason && (
                      <p className="mt-1 text-muted">{invoice.void_reason}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    {formatDateTime(invoice.created_at)}
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
