import { env } from "cloudflare:workers";
import { relayUrl } from "#lib/server/wiki.ts";
export function load() {
  const url = new URL(relayUrl());
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  const hostname = "ADMIN_HOSTNAME" in env ? env.ADMIN_HOSTNAME : undefined;
  return {
    apiUrl: new URL("/admin/articles", url).href,
    adminBase: hostname ? "" : "/admin",
  };
}
