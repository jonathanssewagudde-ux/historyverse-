import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ChangePasswordForm, ProfileForm, SignOutButton } from "@/components/auth/profile-forms";
import { Button } from "@/components/ui/button";
import { hasPermission, roleLabels } from "@/lib/auth/roles";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      {/* The session is request-time data, so it streams in behind this boundary. */}
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading profile">
      <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      <div className="h-72 animate-pulse rounded-3xl bg-muted" />
    </div>
  );
}

async function ProfileContent() {
  const user = await requireUser("/profile");
  const joined = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    user.createdAt,
  );

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-primary to-pink p-6 text-[oklch(0.99_0_0)] sm:p-8">
        <p className="font-mono text-xs">your profile</p>
        <h1 className="mt-2 text-4xl font-extrabold break-words sm:text-5xl">{user.name}</h1>
        <p className="mt-2 break-all">{user.email}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-lime-foreground"
            data-testid="role-badge"
          >
            {roleLabels[user.role]}
          </span>
          <span className="rounded-full bg-black/25 px-3 py-1 font-mono text-xs">
            joined {joined}
          </span>
        </div>
      </section>

      {hasPermission(user.role, "studio:access") && (
        <section className="flex flex-col items-start justify-between gap-3 rounded-3xl border bg-card p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">AI Studio</h2>
            <p className="text-sm text-muted-foreground">Research, write, review and publish.</p>
          </div>
          <Button asChild>
            <Link href="/admin">Open the Studio</Link>
          </Button>
        </section>
      )}

      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <h2 className="mb-5 text-2xl font-bold">Details</h2>
        <ProfileForm name={user.name} bio={user.bio ?? ""} />
      </section>

      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <h2 className="mb-5 text-2xl font-bold">Password</h2>
        <ChangePasswordForm />
      </section>

      <section className="flex flex-col items-start justify-between gap-3 rounded-3xl border bg-card p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold">Session</h2>
          <p className="text-sm text-muted-foreground">Sign out of HISTORYVERSE on this device.</p>
        </div>
        <SignOutButton />
      </section>
    </div>
  );
}
