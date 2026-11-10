import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell
      kicker="welcome back"
      title="Sign in"
      description="Pick up where you left off: your bookmarks, reading history and collections."
      footer={
        <>
          New here?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {/* The form reads ?next= from the URL, which is request-time data. */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
