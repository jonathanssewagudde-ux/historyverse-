"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import {
  authErrorMessage,
  changePasswordSchema,
  fieldErrors,
  PASSWORD_MIN_LENGTH,
  profileSchema,
  type FieldErrors,
} from "@/lib/auth/validation";

export function ProfileForm({ name, bio }: { name: string; bio: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<{ name: string; bio: string }>>({});
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string }>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = profileSchema.safeParse({ name: data.get("name"), bio: data.get("bio") ?? "" });
    setMessage(undefined);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { error } = await authClient.updateUser({ name: parsed.data.name, bio: parsed.data.bio });
    setPending(false);
    if (error) return setMessage({ kind: "error", text: authErrorMessage(error) });
    setMessage({ kind: "success", text: "Profile saved." });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Profile details">
      <FormMessage kind={message?.kind ?? "success"}>{message?.text}</FormMessage>
      <Field
        id="profile-name"
        name="name"
        label="Name"
        defaultValue={name}
        autoComplete="name"
        required
        error={errors.name}
      />
      <div className="space-y-2">
        <Label htmlFor="profile-bio">About you</Label>
        <textarea
          id="profile-bio"
          name="bio"
          defaultValue={bio}
          rows={3}
          maxLength={500}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby={errors.bio ? "profile-bio-error" : undefined}
          className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          placeholder="What parts of history are you into?"
        />
        {errors.bio && (
          <p id="profile-bio-error" className="text-sm font-medium text-destructive">
            {errors.bio}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [errors, setErrors] = useState<
    FieldErrors<{ currentPassword: string; newPassword: string }>
  >({});
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string }>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = changePasswordSchema.safeParse({
      currentPassword: data.get("currentPassword"),
      newPassword: data.get("newPassword"),
    });
    setMessage(undefined);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    // Signing out other devices limits the damage if the old password had leaked.
    const { error } = await authClient.changePassword({
      ...parsed.data,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) return setMessage({ kind: "error", text: authErrorMessage(error) });
    form.reset();
    setMessage({ kind: "success", text: "Password changed. Other devices have been signed out." });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Change password">
      <FormMessage kind={message?.kind ?? "success"}>{message?.text}</FormMessage>
      <Field
        id="current-password"
        name="currentPassword"
        type="password"
        label="Current password"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <Field
        id="new-password"
        name="newPassword"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={errors.newPassword}
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
