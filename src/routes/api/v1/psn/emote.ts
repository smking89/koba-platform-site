import { createFileRoute } from "@tanstack/react-router";
import { recordPsnEmote } from "@/lib/psn/psn-link.server";

const EMOTE_LINE = /^\[PLAYER_EMOTE\] User: (.+), PSN_ID: (\d+), Emote: KOBA_Link$/;

export const Route = createFileRoute("/api/v1/psn/emote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { line?: string } | null;
        const match = body?.line?.match(EMOTE_LINE);
        if (!match) return Response.json({ error: "No KOBA_Link emote in that line." }, { status: 400 });
        const [, psnName, psnId] = match;
        recordPsnEmote(psnName, psnId);
        return Response.json({ ok: true });
      },
    },
  },
});
