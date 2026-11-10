"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Studio navigation link that marks itself as the current page. */
export function StudioLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && "bg-accent")}
    >
      {children}
    </Link>
  );
}
