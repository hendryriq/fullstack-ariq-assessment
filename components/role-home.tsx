import { signOut } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth";

// Temporary landing content until each role's real pages are built.
export function RoleHome({ user }: { user: CurrentUser }) {
  return (
    <main className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">{user.fullName}</h1>
      <p>Signed in as {user.role}</p>
      <form action={signOut}>
        <button type="submit" className="rounded border px-3 py-2 font-medium">
          Sign out
        </button>
      </form>
    </main>
  );
}
