import Link from "next/link";
import type { Route } from "next";

import { isRouteAvailable, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * Links to implemented routes; renders unimplemented ones as clearly unavailable text so the
 * navigation never leads to a dead end.
 */
export function NavLink({
  item,
  className,
  children,
}: {
  item: NavItem;
  className?: string;
  children?: React.ReactNode;
}) {
  const content = children ?? item.title;
  if (isRouteAvailable(item.href)) {
    return (
      <Link href={item.href as Route} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <span
      aria-disabled="true"
      title={`Coming in Milestone ${item.milestone}`}
      data-unavailable=""
      className={cn(className, "cursor-default opacity-55")}
    >
      {content}
      <span className="sr-only"> (coming soon)</span>
    </span>
  );
}
