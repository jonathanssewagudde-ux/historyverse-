import "server-only";

import type { SourceHttpClient } from "@/server/sources/http";
import type { WbEntity } from "./types";

const ENTITY_DATA = "https://www.wikidata.org/wiki/Special:EntityData";
const SPARQL = "https://query.wikidata.org/sparql";

export const isQid = (value: string) => /^Q[1-9]\d*$/.test(value);
export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;

export interface WikidataClient {
  getEntity(qid: string): Promise<WbEntity>;
  getLabels(qids: string[]): Promise<Map<string, string>>;
  sparql<T extends Record<string, { value: string }>>(query: string): Promise<T[]>;
}

/**
 * Wikidata access. Entities come from Special:EntityData (cache-friendly, lightly rate limited)
 * rather than the action API, and discovery uses the SPARQL endpoint.
 */
export function createWikidataClient(http: SourceHttpClient): WikidataClient {
  async function sparql<T extends Record<string, { value: string }>>(query: string): Promise<T[]> {
    const url = `${SPARQL}?format=json&query=${encodeURIComponent(query)}`;
    const data = await http.getJson<{ results: { bindings: T[] } }>(url, {
      headers: { Accept: "application/sparql-results+json" },
    });
    return data.results.bindings;
  }

  return {
    sparql,
    async getEntity(qid) {
      if (!isQid(qid)) throw new Error(`Not a Wikidata item id: ${qid}`);
      const data = await http.getJson<{ entities: Record<string, WbEntity> }>(
        `${ENTITY_DATA}/${qid}.json`,
      );
      // A redirected item is returned under its target id.
      const entity = data.entities[qid] ?? Object.values(data.entities)[0];
      if (!entity) throw new Error(`Wikidata returned no entity for ${qid}`);
      return entity;
    },
    async getLabels(qids) {
      const labels = new Map<string, string>();
      const unique = [...new Set(qids.filter(isQid))];
      for (let i = 0; i < unique.length; i += 150) {
        const values = unique
          .slice(i, i + 150)
          .map((q) => `wd:${q}`)
          .join(" ");
        const rows = await sparql<{ i: { value: string }; l: { value: string } }>(
          `SELECT ?i ?l WHERE { VALUES ?i { ${values} } ?i rdfs:label ?l . FILTER(LANG(?l) = "en") }`,
        );
        for (const row of rows) labels.set(row.i.value.split("/").pop()!, row.l.value);
      }
      return labels;
    },
  };
}
