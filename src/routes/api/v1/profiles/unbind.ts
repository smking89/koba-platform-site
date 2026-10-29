import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

const UNBINDABLE_COLUMNS = new Set(["steam_id", "xbox_xuid", "psn_id"]);

export const Route = createFileRoute("/api/v1/profiles/unbind")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { kobaId?: string; platform?: string } | null;
        if (!body?.kobaId || !body.platform || !UNBINDABLE_COLUMNS.has(body.platform)) {
          return Response.json({ error: "kobaId and platform ('steam_id' | 'xbox_xuid' | 'psn_id') are required." }, { status: 400 });
        }
        const sql = await getSql();
        // Column name is checked against UNBINDABLE_COLUMNS above, not interpolated from arbitrary input.
        await sql.query(`update players set ${body.platform} = null where id = $1`, [body.kobaId]);
        return Response.json({ ok: true });
      },
    },
  },
});
