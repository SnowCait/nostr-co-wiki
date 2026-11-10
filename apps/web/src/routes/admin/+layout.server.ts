import { relayUrl } from "#lib/server/wiki.ts";
export function load() {
  const url = new URL(relayUrl());
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return {
    apiUrl: new URL("/admin/articles", url).href,
  };
}
