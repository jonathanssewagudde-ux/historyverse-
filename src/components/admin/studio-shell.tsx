import Link from "next/link";

import { StudioLink } from "@/components/admin/studio-link";
import { UserMenu } from "@/components/auth/user-menu";
import { Wordmark } from "@/components/site/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { isRouteAvailable } from "@/config/navigation";
import { studioNav } from "@/config/studio-navigation";
import { cn } from "@/lib/utils";

/**
 * AI Studio frame: top bar plus module navigation. The frame itself is static; who may see what
 * is decided inside each page, on the server. Modules that are not built yet are listed with
 * their milestone and are not links.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Link
            href="/admin"
            aria-label="AI Studio home"
            className="flex items-center gap-2 rounded-full"
          >
            <Wordmark />
            <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-[0.65rem] font-medium text-lime-foreground">
              studio
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:block"
            >
              View site
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav aria-label="Studio" className="border-b lg:w-72 lg:shrink-0 lg:border-r lg:border-b-0">
          <ul className="flex gap-1 overflow-x-auto p-3 lg:sticky lg:top-14 lg:max-h-[calc(100svh-3.5rem)] lg:flex-col lg:overflow-y-auto lg:p-4">
            {studioNav.map((item) => {
              const available = isRouteAvailable(item.href);
              const className = cn(
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap",
                available ? "text-foreground hover:bg-accent" : "text-muted-foreground",
              );
              return (
                <li key={item.href}>
                  {available ? (
                    <StudioLink href={item.href} className={className}>
                      {item.title}
                    </StudioLink>
                  ) : (
                    <span
                      className={className}
                      aria-disabled="true"
                      title={`Coming in Milestone ${item.milestone}`}
                    >
                      {item.title}
                      <span className="rounded-full border px-1.5 py-0.5 font-mono text-[0.6rem] font-normal">
                        M{item.milestone}
                      </span>
                      <span className="sr-only"> (coming soon)</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
