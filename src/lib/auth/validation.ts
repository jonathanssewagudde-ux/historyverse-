import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

// Trim and lowercase first, so a stray space or capital letter is not treated as invalid.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));
const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Use at most 80 characters."),
  email,
  password: newPassword,
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Use at most 80 characters."),
  bio: z.string().trim().max(500, "Use at most 500 characters."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ["newPassword"],
    message: "Choose a password you have not just used.",
  });

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First validation message per field, for inline form errors. */
export function fieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out as FieldErrors<T>;
}

/**
 * Sanitise a post-sign-in redirect target. Only same-site absolute paths are allowed, which
 * blocks open redirects such as `//evil.example`, `/\evil.example` or `https://evil.example`.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/profile"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\"))
    return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** Human-readable message for an auth API failure. Never echoes server internals. */
export function authErrorMessage(
  error: { code?: string; status?: number; message?: string } | null | undefined,
): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (error.status === 503) return "Accounts are not available right now. Please try again later.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password do not match.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try signing in instead.";
    case "INVALID_PASSWORD":
      return "Your current password is incorrect.";
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    case "PASSWORD_TOO_LONG":
      return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
    default:
      return "Something went wrong. Please try again.";
  }
}
