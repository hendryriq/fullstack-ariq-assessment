import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, PageHeader, PageLoading, Table } from "@/components/ui";
import type { Json } from "@/lib/database.types";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit" };

const RECORD_TYPES = ["class", "enrollment", "invoice", "lesson", "logbook"];
const RECENT_EVENTS = 200;

const HIDDEN_DETAILS = new Set(["invoice_id", "enrollment_id", "logbook_id"]);
const MONEY_DETAILS = new Set([
  "amount",
  "total",
  "student_rate",
  "tutor_rate",
]);

export default function AdminAuditPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {searchParams.then(({ type }) => (
        <AuditLog type={typeof type === "string" ? type : undefined} />
      ))}
    </Suspense>
  );
}

async function AuditLog({ type }: { type?: string }) {
  await requireRole("admin");

  const activeType = type && RECORD_TYPES.includes(type) ? type : undefined;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select(
      "id, event_type, entity_type, metadata, created_at, actor:users(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(RECENT_EVENTS);

  if (activeType) {
    query = query.eq("entity_type", activeType);
  }

  const [events, tutors] = await Promise.all([
    query,
    supabase.from("users").select("id, full_name").eq("role", "tutor"),
  ]);

  if (events.error) throw events.error;
  if (tutors.error) throw tutors.error;

  const tutorNames = new Map(
    tutors.data.map((tutor) => [tutor.id, tutor.full_name]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit"
        description={`The latest ${RECENT_EVENTS} changes to money, access and logbooks. This record cannot be edited.`}
      />
      <div className="flex flex-wrap gap-2">
        <FilterLink label="All" href="/admin/audit" active={!activeType} />
        {RECORD_TYPES.map((recordType) => (
          <FilterLink
            key={recordType}
            label={recordType}
            href={`/admin/audit?type=${recordType}`}
            active={activeType === recordType}
          />
        ))}
      </div>
      <Card>
        {events.data.length === 0 ? (
          <p className="text-sm text-muted">No events found.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Event</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.data.map((event) => (
                <tr key={event.id} className="align-top">
                  <td className="whitespace-nowrap text-muted">
                    {formatDateTime(event.created_at)}
                  </td>
                  <td className="whitespace-nowrap">
                    {event.actor?.full_name ?? "System"}
                  </td>
                  <td className="font-medium whitespace-nowrap capitalize">
                    {event.event_type.replaceAll("_", " ")}
                  </td>
                  <td>
                    {describeDetails(event.metadata, tutorNames).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
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

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-card px-3 py-1 text-sm font-medium capitalize ${
        active ? "bg-gold" : "border border-cloud hover:bg-cloud/50"
      }`}
    >
      {label}
    </Link>
  );
}

function formatDetail(
  key: string,
  value: Json | undefined,
  tutorNames: Map<string, string>,
) {
  if (MONEY_DETAILS.has(key) && typeof value === "number") {
    return formatRupiah(value);
  }

  if (key === "tutor_id" && typeof value === "string") {
    return tutorNames.get(value) ?? "Unknown tutor";
  }

  return String(value);
}

// Turns stored details into short lines. A two-item list is [before, after].
function describeDetails(metadata: Json, tutorNames: Map<string, string>) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata).flatMap(([key, value]) => {
    if (HIDDEN_DETAILS.has(key) || value === null || value === undefined) {
      return [];
    }

    const label = key.replace("_id", "").replaceAll("_", " ");

    if (Array.isArray(value)) {
      const [before, after] = value;

      if (before === after) {
        return [];
      }

      return `${label}: ${formatDetail(key, before, tutorNames)} → ${formatDetail(key, after, tutorNames)}`;
    }

    return `${label}: ${formatDetail(key, value, tutorNames)}`;
  });
}
