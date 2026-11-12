import type { Metadata } from "next";
import { Suspense } from "react";

import { EntityManager } from "@/components/admin/entity-manager";

export const metadata: Metadata = { title: "People" };

export default function PeopleManagerPage({ searchParams }: PageProps<"/admin/people">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <EntityManager manager="people" searchParams={searchParams} />
    </Suspense>
  );
}
