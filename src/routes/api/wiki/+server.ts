import { json } from "@sveltejs/kit";
import { wiki } from "#lib/server/wiki.ts";
export async function GET() {
  return json(
    { pubkey: await wiki().getWikiPublicKey() },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
