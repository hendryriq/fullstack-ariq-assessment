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
import { formatDateTime, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cancelInvoice, markInvoicePaid, voidInvoice } from "./actions";

export const metadata: Metadata = { title: "Invoices" };

export default function AdminInvoicesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <InvoicesContent />
    </Suspense>
  );
}

async function InvoicesContent() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, hours, rate_snapshot, amount, status, created_at, reference_note, void_reason, enrollment:enrollments(student:users(full_name, email), class:classes(title))",
    )
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Unpaid invoices come first, oldest at the top. The rest are newest first.
  const unpaid = data.filter((invoice) => invoice.status === "pending");
  const others = data.filter((invoice) => invoice.status !== "pending");
  const invoices = [...unpaid, ...others.reverse()];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="Payment is simulated: marking an invoice paid gives the student access."
      />
      <Card>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="align-top">
                  <td>
                    <p className="font-medium">
                      {invoice.enrollment.student.full_name}
                    </p>
                    <p className="text-muted">
                      {invoice.enrollment.student.email}
                    </p>
                  </td>
                  <td>{invoice.enrollment.class.title}</td>
                  <td className="whitespace-nowrap">
                    {invoice.hours} h × {formatRupiah(invoice.rate_snapshot)}
                  </td>
                  <td className="whitespace-nowrap font-medium">
                    {formatRupiah(invoice.amount)}
                  </td>
                  <td>
                    <StatusBadge status={invoice.status as Status} />
                    {(invoice.void_reason || invoice.reference_note) && (
                      <p className="mt-1 text-muted">
                        {invoice.void_reason ?? invoice.reference_note}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    {formatDateTime(invoice.created_at)}
                  </td>
                  <td>
                    <InvoiceActions
                      invoiceId={invoice.id}
                      status={invoice.status}
                    />
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

function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const invoiceField = (
    <input type="hidden" name="invoice_id" value={invoiceId} />
  );

  if (status === "pending") {
    return (
      <div className="flex flex-col gap-2">
        <Disclosure label="Mark paid">
          <ActionForm action={markInvoicePaid} submitLabel="Confirm payment">
            {invoiceField}
            <Field label="Reference note (optional)">
              <Input name="reference_note" />
            </Field>
          </ActionForm>
        </Disclosure>
        <Disclosure label="Cancel">
          <ActionForm
            action={cancelInvoice}
            submitLabel="Cancel invoice"
            variant="danger"
          >
            {invoiceField}
            <Field label="Reason (optional)">
              <Input name="reason" />
            </Field>
          </ActionForm>
        </Disclosure>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <Disclosure label="Void">
        <ActionForm
          action={voidInvoice}
          submitLabel="Void invoice"
          variant="danger"
          confirmMessage="Void this invoice? If no paid invoice remains, the student loses access and the seat is freed."
        >
          {invoiceField}
          <Field label="Reason">
            <Input name="reason" required />
          </Field>
        </ActionForm>
      </Disclosure>
    );
  }

  return null;
}
