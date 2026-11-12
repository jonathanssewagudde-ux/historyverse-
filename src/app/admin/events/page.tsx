import type { Metadata } from "next";
import { Suspense } from "react";

import { EntityManager } from "@/components/admin/entity-manager";

export const metadata: Metadata = { title: "Events and periods" };

export default function EventsManagerPage({ searchParams }: PageProps<"/admin/events">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <EntityManager manager="events" searchParams={searchParams} />
    </Suspense>
  );
}
