import { Card, StatusBadge, Table } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";

// Temporary landing content until each role's real pages are built.
export function RoleHome({ user }: { user: CurrentUser }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{user.fullName}</h1>
        <p className="text-sm text-muted">Signed in as {user.role}</p>
      </div>
      <Card>
        <h2 className="mb-4 font-semibold">Your account</h2>
        <Table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{user.email}</td>
              <td className="capitalize">{user.role}</td>
              <td>
                <StatusBadge status="active" />
              </td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
