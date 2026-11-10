import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell
      kicker="join in"
      title="Create your account"
      description="Free, and you can browse everything without one. An account lets you save and follow history."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
