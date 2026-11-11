"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

type Props = { href: string; className?: string; children: React.ReactNode };

function ActiveStudioLink({ href, className, children }: Props) {
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

/**
 * Studio navigation link that marks itself as the current page. Reading the URL is request-time
 * data, so the highlight streams in; the plain link renders immediately as the fallback.
 */
export function StudioLink(props: Props) {
  return (
    <Suspense
      fallback={
        <Link href={props.href as Route} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <ActiveStudioLink {...props} />
    </Suspense>
  );
}
