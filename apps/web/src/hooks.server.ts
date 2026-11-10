import { env } from "cloudflare:workers";
import { error } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
export const handle: Handle = async ({ event, resolve }) => {
  const hostname = "ADMIN_HOSTNAME" in env ? env.ADMIN_HOSTNAME : undefined;
  if (
    hostname &&
    event.url.hostname !== hostname &&
    (event.url.pathname === "/admin" ||
      event.url.pathname.startsWith("/admin/"))
  ) {
    error(404, "Not found");
  }
  return resolve(event);
};
