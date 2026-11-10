"use client";

import { Brand } from "@/components/brand";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Brand />
        <Card>
          <h1 className="mb-2 text-2xl font-semibold">Something went wrong</h1>
          <p className="mb-4 text-sm">
            We could not load this page. Please try again.
          </p>
          <Button type="button" onClick={() => retry()}>
            Try again
          </Button>
        </Card>
      </div>
    </main>
  );
}
