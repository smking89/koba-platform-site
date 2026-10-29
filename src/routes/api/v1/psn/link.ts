import { createFileRoute } from "@tanstack/react-router";
import { claimPsnLink } from "@/lib/psn/psn-link.server";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/v1/psn/link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { kobaId?: string; psnName?: string } | null;
        if (!body?.kobaId || !body.psnName) return Response.json({ error: "kobaId and psnName are required." }, { status: 400 });

        const claimed = claimPsnLink(body.psnName);
        if (!claimed) return Response.json({ error: "No KOBA_Link emote seen for that name in the last 5 minutes." }, { status: 404 });

        const sql = await getSql();
        await sql`update players set psn_id = ${claimed.psnId} where id = ${body.kobaId}`;
        return Response.json({ ok: true, psnId: claimed.psnId });
      },
    },
  },
});
