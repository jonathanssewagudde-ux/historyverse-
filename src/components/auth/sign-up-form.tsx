"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import {
  authErrorMessage,
  fieldErrors,
  PASSWORD_MIN_LENGTH,
  safeNextPath,
  signUpSchema,
  type FieldErrors,
} from "@/lib/auth/validation";

type Values = { name: string; email: string; password: string };

export function SignUpForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError(undefined);
      return;
    }
    setErrors({});
    setFormError(undefined);
    setPending(true);
    const { error } = await authClient.signUp.email(parsed.data);
    if (error) {
      setPending(false);
      setFormError(authErrorMessage(error));
      return;
    }
    router.push(next as Route);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormMessage kind="error">{formError}</FormMessage>
      <Field id="name" name="name" label="Name" autoComplete="name" required error={errors.name} />
      <Field
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <Field
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A long passphrase works best.`}
        error={errors.password}
      />
      <Button type="submit" variant="lime" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
