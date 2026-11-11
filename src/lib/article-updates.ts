import { validateEvent, verifyEvent, type Event } from "nostr-tools/pure";
import { isHex32 } from "nostr-tools/utils";
import { tag } from "#lib/article.ts";

export function subscribeArticle(
  relay: string,
  pubkey: string,
  d: string,
  receive: (article: Event) => void,
): () => void {
  let socket: WebSocket;
  let stopped = false;
  let retries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subscription = "article-updates";
  function connect() {
    socket = new WebSocket(relay);
    socket.onopen = () => {
      socket.send(
        JSON.stringify([
          "REQ",
          subscription,
          { kinds: [30818], authors: [pubkey], "#d": [d], limit: 1 },
        ]),
      );
    };
    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(data);
        if (
          !Array.isArray(message) ||
          message.length !== 3 ||
          message[0] !== "EVENT" ||
          message[1] !== subscription
        ) {
          return;
        }
        const event = message[2];
        if (
          !validateEvent(event) ||
          typeof event.id !== "string" ||
          !isHex32(event.id) ||
          typeof event.sig !== "string" ||
          !Number.isSafeInteger(event.created_at) ||
          event.created_at < 0 ||
          event.kind !== 30818 ||
          event.pubkey !== pubkey ||
          tag(event, "d") !== d ||
          !isHex32(tag(event, "head") ?? "") ||
          !verifyEvent(event)
        ) {
          return;
        }
        receive(event);
      } catch {
        // Malformed relay messages do not interrupt reading or editing.
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      // Keep the retry budget across connections, including short-lived ones.
      if (!stopped && retries < 5) {
        timer = setTimeout(connect, 1000 * 2 ** retries++);
      }
    };
  }
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(["CLOSE", subscription]));
    }
    socket.close();
  };
}
