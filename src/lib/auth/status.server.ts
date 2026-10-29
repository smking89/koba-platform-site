/**
 * Which external sign-in providers this build can actually start.
 *
 * Steam/Xbox are registered on the auth server only when their credentials are
 * present (see `src/lib/auth/server.ts`), so the client asks here instead of
 * rendering buttons that would 404. `authOff` is true in the local preview
 * where the app runs as its dev user and no provider round-trip is possible.
 */
export type SignInOptions = {
  steam: boolean;
  xbox: boolean;
  /** False when sign-in itself is disabled for this run (VITE_AUTH_ENABLED=false). */
  authEnabled: boolean;
};

export function signInOptions(): SignInOptions {
  const env = (key: string) => process.env[key]?.trim() || "";
  return {
    steam: Boolean(env("STEAM_WEB_API_KEY")),
    xbox: Boolean(env("XBOX_CLIENT_ID") && env("XBOX_CLIENT_SECRET")),
    authEnabled: process.env.VITE_AUTH_ENABLED !== "false",
  };
}
