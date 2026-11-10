import Link from "next/link";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Brand />
        <Card>
          <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
          <p className="mb-4 text-sm">This page could not be found.</p>
          <Link href="/" className="text-sm font-medium underline">
            Go to your home page
          </Link>
        </Card>
      </div>
    </main>
  );
}
