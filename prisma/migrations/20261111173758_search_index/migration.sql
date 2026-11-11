-- CreateTable
CREATE TABLE "search_documents" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "template" "ArticleTemplate" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "names" TEXT[],
    "countries" TEXT[],
    "continents" TEXT[],
    "startYear" INTEGER,
    "endYear" INTEGER,
    "dateYears" INTEGER[],
    "keyDates" JSONB NOT NULL DEFAULT '[]',
    "heroMediaId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "matchText" TEXT NOT NULL DEFAULT '',
    "searchVector" tsvector,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_articleId_key" ON "search_documents"("articleId");

-- CreateIndex
CREATE INDEX "search_documents_template_idx" ON "search_documents"("template");

-- CreateIndex
CREATE INDEX "search_documents_startYear_endYear_idx" ON "search_documents"("startYear", "endYear");

-- AddForeignKey
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------- search functions & indexes
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is STABLE because its dictionary can change; pinning the dictionary makes this
-- wrapper safe to declare IMMUTABLE so it can be used in indexes.
CREATE OR REPLACE FUNCTION hv_unaccent(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;

-- How a document is weighted. Names use the 'simple' configuration (no English stemming, so
-- "Muteesa" stays "muteesa"); prose uses 'english' (stemming and stop words).
--   A: title and names    B: subtitle and summary    C: body text
CREATE OR REPLACE FUNCTION hv_search_vector(title text, names text[], subtitle text, summary text, body text)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT
    setweight(to_tsvector('english', hv_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('simple', hv_unaccent(coalesce(title, '') || ' ' || array_to_string(coalesce(names, '{}'), ' '))), 'A') ||
    setweight(to_tsvector('english', hv_unaccent(coalesce(subtitle, '') || ' ' || coalesce(summary, ''))), 'B') ||
    setweight(to_tsvector('english', hv_unaccent(coalesce(body, ''))), 'C')
$$;

-- The query side, mirroring the document side.
CREATE OR REPLACE FUNCTION hv_search_query(q text) RETURNS tsquery
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT websearch_to_tsquery('english', hv_unaccent(q)) || websearch_to_tsquery('simple', hv_unaccent(q)) $$;

CREATE INDEX "search_documents_vector_idx" ON "search_documents" USING GIN ("searchVector");
CREATE INDEX "search_documents_match_trgm_idx" ON "search_documents" USING GIN ("matchText" gin_trgm_ops);
CREATE INDEX "search_documents_date_years_idx" ON "search_documents" USING GIN ("dateYears");
