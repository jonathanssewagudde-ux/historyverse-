"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { NavLink } from "@/components/site/nav-link";
import { Wordmark } from "@/components/site/wordmark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isRouteAvailable, primaryNav } from "@/config/navigation";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto">
        <SheetHeader className="border-b">
          <SheetTitle>
            <Wordmark />
          </SheetTitle>
          <SheetDescription>Explore the story of our world.</SheetDescription>
        </SheetHeader>
        {/* Close after following a link; unavailable items are plain text and keep the menu open. */}
        <nav
          aria-label="Mobile"
          className="px-2"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <Link
            href="/#search"
            className="mb-2 flex items-center gap-3 rounded-md border px-3 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="size-4" aria-hidden />
            Search history
          </Link>
          <ul className="flex flex-col">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  className="flex flex-col rounded-md px-3 py-3 transition-colors hover:bg-accent"
                >
                  <span className="flex items-center justify-between font-serif text-lg">
                    {item.title}
                    {!isRouteAvailable(item.href) && (
                      <span className="font-sans text-[0.65rem] tracking-wider text-muted-foreground uppercase">
                        Milestone {item.milestone}
                      </span>
                    )}
                  </span>
                  {item.description && (
                    <span className="text-sm text-muted-foreground">{item.description}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
