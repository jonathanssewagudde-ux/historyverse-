import { toNextJsHandler } from "better-auth/next-js";

import { getAuth, isAuthConfigured } from "@/server/auth/auth";

function unavailable() {
  return Response.json(
    { code: "AUTH_NOT_CONFIGURED", message: "Accounts are not configured on this deployment." },
    { status: 503 },
  );
}

/** Better Auth endpoints (sign-up, sign-in, session, sign-out, …). */
export async function GET(request: Request) {
  if (!isAuthConfigured()) return unavailable();
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  if (!isAuthConfigured()) return unavailable();
  return toNextJsHandler(getAuth()).POST(request);
}
