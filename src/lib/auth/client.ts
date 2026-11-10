"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. Talks to /api/auth on the same origin. */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", input: false },
        bio: { type: "string", required: false },
        locale: { type: "string", required: false },
      },
    }),
  ],
});
