/**
 * Citation markers in article text.
 *
 * Authoring form (data files):  ...a sentence.[@loc-1990|Long-Distance Trade and Foreign Contact]
 * Stored form (database):       ...a sentence.[^3]
 *
 * `[@key]` or `[@key|locator]` names a declared source. The loader turns each marker into a
 * section-local position `[^n]` that matches a Citation row, so stored text never contains URLs.
 */

export const AUTHOR_MARKER = /\[@([a-z0-9][a-z0-9-]*)(?:\|([^\]]+))?\]/g;
export const STORED_MARKER = /\[\^(\d+)\]/g;

export interface CitationRef {
  sourceKey: string;
  locator: string | null;
}

/** Replace authoring markers with positions; identical (source, locator) pairs share a position. */
export function compileCitations(body: string): { body: string; citations: CitationRef[] } {
  const citations: CitationRef[] = [];
  const index = new Map<string, number>();
  const compiled = body.replace(AUTHOR_MARKER, (_, sourceKey: string, locator?: string) => {
    const id = `${sourceKey}|${locator?.trim() ?? ""}`;
    let position = index.get(id);
    if (position === undefined) {
      citations.push({ sourceKey, locator: locator?.trim() || null });
      position = citations.length;
      index.set(id, position);
    }
    return `[^${position}]`;
  });
  return { body: compiled, citations };
}
