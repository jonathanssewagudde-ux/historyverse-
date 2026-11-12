import type { Metadata } from "next";
import { Suspense } from "react";

import { EntityManager } from "@/components/admin/entity-manager";

export const metadata: Metadata = { title: "Kingdoms and states" };

export default function KingdomsManagerPage({ searchParams }: PageProps<"/admin/kingdoms">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <EntityManager manager="kingdoms" searchParams={searchParams} />
    </Suspense>
  );
}
