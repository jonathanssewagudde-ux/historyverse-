import type { Metadata } from "next";
import { Suspense } from "react";

import { EntityManager } from "@/components/admin/entity-manager";

export const metadata: Metadata = { title: "Civilizations" };

export default function CivilizationsManagerPage({
  searchParams,
}: PageProps<"/admin/civilizations">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <EntityManager manager="civilizations" searchParams={searchParams} />
    </Suspense>
  );
}
