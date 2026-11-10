import { CheckCircle2, CircleDashed, Clock } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { milestones, type MilestoneStatus } from "@/config/milestones";
import { siteConfig } from "@/config/site";

const statusMeta: Record<MilestoneStatus, { label: string; icon: typeof Clock }> = {
  complete: { label: "Complete", icon: CheckCircle2 },
  in_review: { label: "In review", icon: Clock },
  in_progress: { label: "In progress", icon: Clock },
  planned: { label: "Planned", icon: CircleDashed },
};

/**
 * Development landing page for the foundation milestone. The cinematic public homepage replaces
 * this in Milestone 2; the milestone tracker then moves to the administrator dashboard.
 */
export default function FoundationPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-serif text-xl font-semibold tracking-[0.2em] text-gold">
          {siteConfig.name}
        </span>
        <ThemeToggle />
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <section className="py-12 sm:py-20" aria-labelledby="hero-title">
          <Badge variant="outline" className="mb-6 border-gold/50 text-gold">
            Platform foundation · in development
          </Badge>
          <h1
            id="hero-title"
            className="max-w-3xl text-4xl leading-tight font-semibold text-balance sm:text-6xl"
          >
            {siteConfig.tagline}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
            {siteConfig.description} The public encyclopedia and the AI Studio are being built in
            fifteen reviewed milestones, and this page tracks their progress.
          </p>
        </section>

        <section aria-labelledby="milestones-title">
          <h2 id="milestones-title" className="mb-6 text-3xl font-semibold">
            Build milestones
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {milestones.map((m) => {
              const meta = statusMeta[m.status];
              const Icon = meta.icon;
              return (
                <li key={m.number}>
                  <Card className="h-full gap-3" data-status={m.status}>
                    <CardHeader>
                      <CardDescription className="flex items-center justify-between text-xs tracking-wider uppercase">
                        <span>Milestone {m.number}</span>
                        <span className="flex items-center gap-1 normal-case">
                          <Icon
                            className={m.status === "planned" ? "size-3.5" : "size-3.5 text-gold"}
                            aria-hidden
                          />
                          {meta.label}
                        </span>
                      </CardDescription>
                      <CardTitle className="font-serif text-xl">{m.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">{m.summary}</CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          {siteConfig.name}: historical content will be published only after it has been sourced and
          reviewed by an editor.
        </div>
      </footer>
    </div>
  );
}
