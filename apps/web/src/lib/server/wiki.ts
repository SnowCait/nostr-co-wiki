import { env } from "cloudflare:workers";
import { error } from "@sveltejs/kit";
import type { Event } from "nostr-tools/pure";
import { tag } from "../article.ts";

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

// Use the Relay's NIP-01 / NIP-50 handler through the existing DO binding.
export async function searchArticles(
  request: Request,
  search: string,
): Promise<Event[]> {
  const object = wiki();
  const pubkey = await object.getWikiPublicKey();
  const response = await object.fetch(
    new Request("https://wiki.internal/", {
      headers: {
        Upgrade: "websocket",
        "CF-Connecting-IP": request.headers.get("CF-Connecting-IP") ?? "",
      },
    }),
  );
  const socket = response.webSocket;
  if (!socket) {
    error(503, "Unable to connect to article search.");
  }
  socket.accept();
  return new Promise((resolve, reject) => {
    const articles: Event[] = [];
    const finish = (failure?: string) => {
      clearTimeout(timeout);
      socket.close(1000);
      if (failure) {
        reject(new Error(failure));
      } else {
        resolve(articles);
      }
    };
    const timeout = setTimeout(
      () => finish("Article search timed out."),
      10000,
    );
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (message[1] !== "search") {
        return;
      }
      if (message[0] === "EVENT") {
        const event = message[2] as Event;
        if (
          event.kind === 30818 &&
          event.pubkey === pubkey &&
          tag(event, "d") !== undefined
        ) {
          articles.push(event);
        }
      } else if (message[0] === "EOSE") {
        socket.send(JSON.stringify(["CLOSE", "search"]));
        finish();
      } else if (message[0] === "CLOSED") {
        finish("Article search was rejected.");
      }
    });
    socket.addEventListener("error", () =>
      finish("Article search connection failed."),
    );
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      reject(new Error("Article search connection closed."));
    });
    socket.send(
      JSON.stringify([
        "REQ",
        "search",
        { kinds: [30818], authors: [pubkey], search, limit: 50 },
      ]),
    );
  });
}
