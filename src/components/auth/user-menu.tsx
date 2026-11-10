"use client";

import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import { hasPermission, isRole, roleLabels } from "@/lib/auth/roles";

/**
 * Account control in the header. It reads the session in the browser, so public pages keep their
 * prerendered static shell. What it shows is a convenience only; the server enforces access.
 */
export function UserMenu() {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return <span aria-hidden className="size-9 animate-pulse rounded-full bg-muted" />;
  }

  if (!data?.user) {
    return (
      <Button size="sm" asChild>
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  const { user } = data;
  const role = isRole(user.role) ? user.role : "USER";
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-pink font-display text-sm font-extrabold text-[oklch(0.99_0_0)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          <span className="mt-1.5 inline-block rounded-full bg-lime px-2 py-0.5 font-mono text-[0.65rem] font-medium text-lime-foreground">
            {roleLabels[role].toLowerCase()}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound aria-hidden /> Profile
          </Link>
        </DropdownMenuItem>
        {hasPermission(role, "studio:access") && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard aria-hidden /> AI Studio
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
