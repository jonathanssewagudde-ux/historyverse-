import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { slugify } from "@/server/sources/wikidata/mapper";

type Actor = { id: string; email?: string | null; role: Role };

export class CategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryError";
  }
}

export async function listCategories(db: PrismaClient) {
  const rows = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { articles: true, entities: true, children: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    parentId: c.parentId,
    articles: c._count.articles,
    entities: c._count.entities,
    children: c._count.children,
  }));
}

export type CategoryRow = Awaited<ReturnType<typeof listCategories>>[number];

function assertAllowed(actor: Actor) {
  if (!hasPermission(actor.role, "taxonomy:manage"))
    throw new CategoryError("Only editors manage categories.");
}

async function checkParent(db: PrismaClient, id: string | null, parentId: string | null) {
  if (!parentId) return null;
  // Walk up from the new parent: reaching the category itself would create a loop.
  let cursor: string | null = parentId;
  for (let depth = 0; cursor && depth < 20; depth++) {
    if (cursor === id) throw new CategoryError("A category cannot be placed inside itself.");
    const parent: { parentId: string | null } | null = await db.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!parent) throw new CategoryError("Parent category not found.");
    cursor = parent.parentId;
  }
  return parentId;
}

export async function saveCategory(
  db: PrismaClient,
  actor: Actor,
  input: { id?: string; name: string; description: string; parentId: string },
) {
  assertAllowed(actor);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new CategoryError("Names are 2 to 80 characters.");
  const parentId = await checkParent(db, input.id ?? null, input.parentId || null);
  const data = { name, description: input.description.trim() || null, parentId };
  if (input.id) {
    const before = await db.category.findUnique({ where: { id: input.id } });
    if (!before) throw new CategoryError("Category not found.");
    // The slug stays stable so public links keep working after a rename.
    await db.category.update({ where: { id: input.id }, data });
    await recordAudit({
      action: "category.updated",
      actor,
      target: { type: "category", id: input.id },
      metadata: { name: [before.name, name] },
    });
    return input.id;
  }
  const slug = slugify(name, "category");
  if (await db.category.findUnique({ where: { slug } }))
    throw new CategoryError(`A category with the address “${slug}” already exists.`);
  const created = await db.category.create({
    data: { ...data, slug, position: await db.category.count() },
  });
  await recordAudit({
    action: "category.created",
    actor,
    target: { type: "category", id: created.id },
    metadata: { slug },
  });
  return created.id;
}

/** Delete an unused category. Categories in use must be emptied first, so nothing is lost silently. */
export async function deleteCategory(db: PrismaClient, actor: Actor, id: string) {
  assertAllowed(actor);
  const category = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { articles: true, entities: true, children: true } } },
  });
  if (!category) throw new CategoryError("Category not found.");
  const { articles, entities, children } = category._count;
  if (articles + entities + children > 0) {
    throw new CategoryError(
      `“${category.name}” is still used by ${articles} article(s), ${entities} entit(ies) and ${children} subcategor(ies).`,
    );
  }
  await db.category.delete({ where: { id } });
  await recordAudit({
    action: "category.deleted",
    actor,
    target: { type: "category", id },
    metadata: { slug: category.slug },
  });
}
