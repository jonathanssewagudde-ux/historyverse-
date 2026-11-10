import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-24"
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
      <SiteFooter />
    </>
  );
}
