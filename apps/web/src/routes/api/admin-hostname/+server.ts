import { env } from "cloudflare:workers";
import { json } from "@sveltejs/kit";
export function GET() {
  return json(
    "ADMIN_HOSTNAME" in env && typeof env.ADMIN_HOSTNAME === "string"
      ? env.ADMIN_HOSTNAME
      : "",
    { headers: { "Cache-Control": "no-store" } },
  );
}
