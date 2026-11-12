import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { CategoryForm } from "@/components/admin/category-form";
import { listCategories } from "@/server/admin/categories";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Categories />
    </Suspense>
  );
}

async function Categories() {
  const auth = await authorize("taxonomy:manage", "/admin/categories");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const categories = await listCategories(getDb());
  const parents = categories.map((c) => ({ id: c.id, name: c.name }));
  const byParent = new Map<string | null, typeof categories>();
  for (const c of categories) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const ordered: { c: (typeof categories)[number]; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      ordered.push({ c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · categories</p>
        <h1 className="mt-2 text-4xl font-extrabold">Categories</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Topics that group articles and records. Assign them to articles in the article editor. A
          category&apos;s address stays the same when it is renamed, and only unused categories can
          be deleted.
        </p>
        <div className="mt-6 rounded-2xl border p-4">
          <h2 className="mb-3 font-semibold">New category</h2>
          <CategoryForm parents={parents} />
        </div>
      </section>
      <section aria-label="All categories" className="space-y-3">
        {ordered.map(({ c, depth }) => (
          <div
            key={c.id}
            className="rounded-3xl border bg-card p-5"
            style={{ marginLeft: `${Math.min(depth, 4) * 1.5}rem` }}
          >
            <p className="mb-3 font-mono text-xs text-muted-foreground">
              /{c.slug} · {c.articles} article(s) · {c.entities} record(s)
            </p>
            <CategoryForm
              category={{
                id: c.id,
                name: c.name,
                description: c.description,
                parentId: c.parentId,
                inUse: c.articles + c.entities + c.children > 0,
              }}
              parents={parents}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
