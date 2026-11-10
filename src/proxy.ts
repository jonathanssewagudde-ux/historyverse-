import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for signed-in areas: visitors without a session cookie are redirected to sign
 * in before any page work happens. This is a convenience, NOT the security boundary — a cookie's
 * presence proves nothing. Every protected page, server action and route handler re-validates
 * the session and checks permissions on the server (see src/server/auth/session.ts).
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request, { cookiePrefix: "hv" })) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*"],
};
