/** Centered card on a neon backdrop, shared by the sign-in and sign-up pages. */
export function AuthShell({
  kicker,
  title,
  description,
  children,
  footer,
}: {
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
      />
      <div
        aria-hidden
        className="absolute -z-20 size-[30rem] rounded-full bg-primary/25 blur-[120px]"
      />
      <div className="w-full max-w-md rounded-3xl border bg-card/90 p-6 shadow-[0_30px_80px_-30px_var(--glow)] backdrop-blur sm:p-8">
        <p className="mb-3 inline-flex rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">
          {kicker}
        </p>
        <h1 className="text-4xl leading-none font-extrabold">{title}</h1>
        <p className="mt-3 mb-7 text-muted-foreground">{description}</p>
        {children}
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
