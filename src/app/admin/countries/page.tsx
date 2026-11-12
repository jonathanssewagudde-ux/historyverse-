import type { Metadata } from "next";
import { Suspense } from "react";

import { EntityManager } from "@/components/admin/entity-manager";

export const metadata: Metadata = { title: "Countries" };

export default function CountriesManagerPage({ searchParams }: PageProps<"/admin/countries">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <EntityManager manager="countries" searchParams={searchParams} />
    </Suspense>
  );
}
