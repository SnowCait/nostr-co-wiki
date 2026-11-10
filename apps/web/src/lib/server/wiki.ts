import { env } from "cloudflare:workers";
import { error } from "@sveltejs/kit";

export function wiki() {
  return env.WIKI.getByName("wiki");
}
export async function publicArticle(d: string) {
  const article = await wiki().getArticle(d);
  if (!article) {
    error(404, "Article not found");
  }
  return article;
}
export function relayUrl(): string {
  const configured = "RELAY_URL" in env ? env.RELAY_URL : undefined;
  if (typeof configured !== "string" || !/^wss?:\/\//.test(configured)) {
    error(503, "The Relay URL is not configured.");
  }
  return configured;
}
