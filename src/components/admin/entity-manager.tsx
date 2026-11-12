import type { Route } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/admin/access-denied";
import { ImportEntityForm } from "@/components/admin/entity-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/lib/auth/roles";
import { ENTITY_MANAGERS, listEntities, type EntityManagerKey } from "@/server/admin/entities";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");

/** One Studio manager (countries, people, kingdoms…): search, import by Wikidata id, review. */
export async function EntityManager({
  manager,
  searchParams,
}: {
  manager: EntityManagerKey;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await authorize("entity:edit", `/admin/${manager}`);
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const config = ENTITY_MANAGERS[manager];
  const rows = await listEntities(getDb(), manager, query);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · {manager}</p>
        <h1 className="mt-2 text-4xl font-extrabold">{config.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Imported statements are unverified leads with their source attached. An editor verifies
          each one against its source before it can be presented as fact.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <form
            role="search"
            aria-label={`Search ${config.title.toLowerCase()}`}
            className="flex items-end gap-2"
          >
            <div className="flex-1 space-y-1.5">
              <label htmlFor="entity-q" className="text-sm font-medium">
                Search by name, alias or Wikidata id
              </label>
              <Input id="entity-q" name="q" type="search" defaultValue={query} />
            </div>
            <Button type="submit" variant="lime">
              Search
            </Button>
          </form>
          <ImportEntityForm defaultKind={config.importKind} />
        </div>
      </section>

      <section aria-labelledby="entity-list" className="rounded-3xl border bg-card p-6">
        <h2 id="entity-list" className="text-2xl font-bold">
          {rows.length} {rows.length === 1 ? "record" : "records"}
          {query && ` matching “${query}”`}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {query ? "Nothing matches." : "Nothing here yet. Import a record by its Wikidata id."}
          </p>
        ) : (
          <div
            role="region"
            aria-label={`${config.title} table`}
            tabIndex={0}
            className="mt-4 overflow-x-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="font-mono text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    name
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    kind
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    dates
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    claims
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    articles
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    wikidata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <th scope="row" className="py-2.5 pr-4 font-medium">
                      <Link
                        href={`/admin/entities/${e.id}` as Route}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {e.name}
                      </Link>
                    </th>
                    <td className="py-2.5 pr-4 text-muted-foreground">{label(e.kind)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{e.dates ?? "—"}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {e.claims}
                      {e.unverified > 0 && (
                        <span className="text-muted-foreground"> · {e.unverified} to check</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">{e.articles}</td>
                    <td className="py-2.5 font-mono">
                      {e.wikidataId ? (
                        <a
                          href={`https://www.wikidata.org/wiki/${e.wikidataId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {e.wikidataId}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!hasPermission(auth.user.role, "claim:verify") && (
          <p className="mt-4 text-sm text-muted-foreground">Editors verify claims.</p>
        )}
      </section>
    </div>
  );
}
