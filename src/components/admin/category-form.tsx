"use client";

import { useActionState, useId } from "react";

import { saveCategoryAction, type CategoryState } from "@/app/admin/categories/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { keepValues } from "@/components/ui/keep-values";

type Option = { id: string; name: string };

export function CategoryForm({
  category,
  parents,
}: {
  category?: {
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    inUse: boolean;
  };
  parents: Option[];
}) {
  const id = useId();
  const [state, act, pending] = useActionState<CategoryState, FormData>(saveCategoryAction, null);
  return (
    <form onSubmit={keepValues(act)} className="space-y-3">
      <input type="hidden" name="categoryId" value={category?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_14rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-n`}>Name</Label>
          <Input id={`${id}-n`} name="name" defaultValue={category?.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-d`}>Description</Label>
          <Input id={`${id}-d`} name="description" defaultValue={category?.description ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-p`}>Inside</Label>
          <select
            id={`${id}-p`}
            name="parentId"
            defaultValue={category?.parentId ?? ""}
            className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="">(top level)</option>
            {parents
              .filter((p) => p.id !== category?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant={category ? "outline" : "lime"} disabled={pending}>
          {category ? "Save" : "Create category"}
        </Button>
        {category && !category.inUse && (
          <Button
            type="submit"
            name="intent"
            value="delete"
            size="sm"
            variant="ghost"
            disabled={pending}
          >
            Delete
          </Button>
        )}
        <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      </div>
    </form>
  );
}
