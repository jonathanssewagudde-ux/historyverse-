import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import type { PublicSection } from "@/lib/content/paths";
import { isPublishedInSection } from "@/server/content/published-lookup";

const ARTICLE_PATH = /^\/(kingdoms|countries|people)\/([^/]+)\/?$/;

/**
 * Runs before routes render.
 *
 * 1. Signed-in areas: visitors without a session cookie are redirected to sign in. This is only
 *    an optimistic gate; every protected page and action re-validates the session on the server.
 * 2. Article URLs: unknown or unpublished slugs are rewritten to a not-found page so they return a
 *    real HTTP 404. Pages stream, and a streamed response is already committed to 200 by the time
 *    the page itself could decide. If the lookup cannot answer, the request passes through and
 *    the page still renders its not-found UI (with noindex).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const article = ARTICLE_PATH.exec(pathname);
  if (article) {
    const published = await isPublishedInSection(
      article[1] as PublicSection,
      decodeURIComponent(article[2]!),
    );
    return published === false
      ? NextResponse.rewrite(new URL("/missing", request.url))
      : NextResponse.next();
  }

  if (getSessionCookie(request, { cookiePrefix: "hv" })) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/profile/:path*",
    "/kingdoms/:slug",
    "/countries/:slug",
    "/people/:slug",
  ],
};
