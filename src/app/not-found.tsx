import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-24"
    >
      <p className="text-sm tracking-widest text-gold uppercase">404</p>
      <h1 className="text-4xl font-semibold">This page is lost to history</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t find the page you were looking for. It may not have been written yet.
      </p>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </main>
  );
}
