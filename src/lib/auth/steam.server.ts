/**
 * Steam sign-in: legacy OpenID 2.0, not OAuth2 - no `genericOAuth` fit, so
 * this is a small custom Better Auth plugin modeled directly on how the
 * built-in `siwe` plugin does the same job for wallet signatures (verify an
 * external proof, then mint a session via `internalAdapter` +
 * `setSessionCookie` - see node_modules/better-auth/dist/plugins/siwe).
 *
 * No client secret for the login itself - Steam's response is trusted only
 * after POSTing it back to Steam with openid.mode=check_authentication and
 * getting `is_valid:true`. Skipping that step is what makes a Steam OpenID
 * integration forgeable, so it is not optional.
 */
import { createAuthEndpoint } from "@better-auth/core/api";
import { APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

const STEAM_NS = "http://specs.openid.net/auth/2.0";
const STEAM_LOGIN_URL = "https://steamcommunity.com/openid/login";
const STEAM_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/;

interface SteamPlayerSummary {
  personaname?: string;
  avatarfull?: string;
}

async function fetchSteamProfile(steamId: string, webApiKey: string): Promise<SteamPlayerSummary | null> {
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${webApiKey}&steamids=${steamId}`;
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { response?: { players?: SteamPlayerSummary[] } } | null;
  return body?.response?.players?.[0] ?? null;
}

export function steamAuth(options: { webApiKey?: string }) {
  return {
    id: "steam",
    endpoints: {
      steamLogin: createAuthEndpoint("/steam/login", { method: "GET" }, async (ctx) => {
        const base = ctx.context.baseURL;
        const params = new URLSearchParams({
          "openid.ns": STEAM_NS,
          "openid.mode": "checkid_setup",
          "openid.return_to": `${base}/steam/callback`,
          "openid.realm": base,
          "openid.identity": `${STEAM_NS}/identifier_select`,
          "openid.claimed_id": `${STEAM_NS}/identifier_select`,
        });
        throw ctx.redirect(`${STEAM_LOGIN_URL}?${params.toString()}`);
      }),
      steamCallback: createAuthEndpoint(
        "/steam/callback",
        { method: "GET", query: z.record(z.string(), z.string()).optional() },
        async (ctx) => {
          const query = ctx.query ?? {};
          const errorRedirect = `${ctx.context.options.onAPIError?.errorURL ?? "/login"}?error=steam_sign_in_failed`;
          if (query["openid.mode"] !== "id_res") throw ctx.redirect(errorRedirect);

          // Verify the response is genuinely from Steam before trusting any of it.
          const verifyParams = new URLSearchParams(query);
          verifyParams.set("openid.mode", "check_authentication");
          const verifyRes = await fetch(STEAM_LOGIN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: verifyParams.toString(),
          });
          const verifyText = await verifyRes.text();
          if (!verifyRes.ok || !/is_valid\s*:\s*true/.test(verifyText)) throw ctx.redirect(errorRedirect);

          const claimedId = query["openid.claimed_id"];
          const match = claimedId?.match(STEAM_ID_RE);
          if (!match) throw ctx.redirect(errorRedirect);
          const steamId = match[1];

          let name = `Steam ${steamId}`;
          let image: string | undefined;
          if (options.webApiKey) {
            const profile = await fetchSteamProfile(steamId, options.webApiKey);
            if (profile?.personaname) name = profile.personaname;
            if (profile?.avatarfull) image = profile.avatarfull;
          }

          const existingAccount = await ctx.context.internalAdapter.findAccountByProviderId(steamId, "steam");
          let user = existingAccount ? await ctx.context.internalAdapter.findUserById(existingAccount.userId) : null;
          if (!user) {
            user = await ctx.context.internalAdapter.createUser({ name, email: `steam-${steamId}@steam.koba.local`, image, emailVerified: false });
            await ctx.context.internalAdapter.createAccount({ userId: user.id, providerId: "steam", accountId: steamId });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not start a session." });
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect("/");
        },
      ),
    },
  };
}
