import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Labelled input with an inline, screen-reader-announced error. */
export function Field({
  id,
  label,
  error,
  hint,
  ...input
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({
  kind,
  children,
}: {
  kind: "error" | "success";
  children?: React.ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      aria-live="polite"
      className={
        children
          ? kind === "error"
            ? "rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            : "rounded-xl bg-lime px-4 py-3 text-sm font-semibold text-lime-foreground"
          : "sr-only"
      }
    >
      {children}
    </p>
  );
}
