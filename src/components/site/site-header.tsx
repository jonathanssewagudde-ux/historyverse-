import Link from "next/link";
import { Search } from "lucide-react";

import { MobileNav } from "@/components/site/mobile-nav";
import { NavLink } from "@/components/site/nav-link";
import { Wordmark } from "@/components/site/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { primaryNav } from "@/config/navigation";

/** Floating glass "pill" navigation bar. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 rounded-full border border-border/70 bg-background/70 pr-2 pl-4 shadow-[0_10px_40px_-20px_var(--glow)] backdrop-blur-xl sm:gap-4 sm:pl-5">
        <Link href="/" aria-label="HISTORYVERSE home" className="shrink-0 rounded-full">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                />
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild>
            <Link href="/#search" aria-label="Search history">
              <Search className="size-5" />
            </Link>
          </Button>
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
