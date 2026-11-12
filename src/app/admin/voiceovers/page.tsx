import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getSpeechStatus, listDocumentaries } from "@/server/documentary/view";

export const metadata: Metadata = { title: "Voiceover Studio" };

export default function VoiceoversPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Voiceovers />
    </Suspense>
  );
}

async function Voiceovers() {
  const auth = await authorize("documentary:edit", "/admin/voiceovers");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const db = getDb();
  const [docs, takes] = await Promise.all([
    listDocumentaries(db),
    db.voiceover.groupBy({
      by: ["provider", "voiceLicense"],
      where: { isCurrent: true },
      _count: true,
    }),
  ]);
  const speech = getSpeechStatus();
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · voiceovers</p>
        <h1 className="mt-2 text-4xl font-extrabold">Voiceover Studio</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Narration is spoken from approved scripts. Synthetic voices are stock voices only;
          nobody&apos;s voice is cloned. Recorded narration needs the speaker&apos;s consent to
          publication, which is stored with the take. Each take records the licence of the voice,
          checked again before a video is published.
        </p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Narration engine</dt>
            <dd className="mt-1 text-sm">
              {speech.ok ? (
                <>
                  <span className="font-mono">{speech.id}</span> · voice {speech.voiceId} ·{" "}
                  {speech.free ? "no charge" : "paid, approved per script"}
                </>
              ) : (
                <span>not available — {speech.reason}</span>
              )}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted p-4">
            <dt className="text-xs text-muted-foreground">Voice licence</dt>
            <dd
              className={`mt-1 text-sm ${speech.ok && !speech.voiceLicense ? "text-destructive" : ""}`}
            >
              {speech.ok
                ? (speech.voiceLicense ??
                  "Not stated. Set TTS_VOICE_LICENSE after checking the voice's model card.")
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="by-doc" className="rounded-3xl border bg-card p-6">
        <h2 id="by-doc" className="text-2xl font-bold">
          Narration by documentary
        </h2>
        <ul className="mt-4 divide-y">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <Link
                href={`/admin/documentaries/${d.id}` as Route}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {d.title}
              </Link>
              <span>
                {d.script
                  ? `${d.script.narrated} of ${d.script.scenes} scenes narrated`
                  : "no script"}
              </span>
            </li>
          ))}
          {docs.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No documentaries yet.</li>
          )}
        </ul>
      </section>
      {takes.length > 0 && (
        <section aria-labelledby="voices" className="rounded-3xl border bg-card p-6">
          <h2 id="voices" className="text-2xl font-bold">
            Voices in use
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {takes.map((t) => (
              <li key={`${t.provider}-${t.voiceLicense}`}>
                <span className="font-mono">{t.provider}</span> · {t._count} current take(s) ·{" "}
                <span className={t.voiceLicense ? "" : "text-destructive"}>
                  {t.voiceLicense ?? "voice licence not stated"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
